import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: "receita" | "despesa";
}

function parseOFX(content: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let match;

  while ((match = stmtTrnRegex.exec(content)) !== null) {
    const block = match[1];

    const dateMatch = block.match(/<DTPOSTED>(\d{8})/);
    const amountMatch = block.match(/<TRNAMT>([-\d.,]+)/);
    const memoMatch = block.match(/<MEMO>([^<\n]+)/) || block.match(/<NAME>([^<\n]+)/);

    if (dateMatch && amountMatch) {
      const rawDate = dateMatch[1];
      const date = `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`;
      const amount = parseFloat(amountMatch[1].replace(",", "."));
      const description = memoMatch ? memoMatch[1].trim() : "Sem descrição";

      transactions.push({
        date,
        description,
        amount: Math.abs(amount),
        type: amount >= 0 ? "receita" : "despesa",
      });
    }
  }

  return transactions;
}

function parseCSV(content: string): ParsedTransaction[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const transactions: ParsedTransaction[] = [];
  const header = lines[0].toLowerCase();

  const sep = header.includes(";") ? ";" : ",";
  const cols = header.split(sep).map((c) => c.trim().replace(/"/g, ""));

  const dateIdx = cols.findIndex((c) => /data|date/.test(c));
  const descIdx = cols.findIndex((c) => /descri|hist|memo|name/.test(c));
  const valueIdx = cols.findIndex((c) => /valor|value|amount|quantia/.test(c));
  const creditIdx = cols.findIndex((c) => /cr[eé]dito|credit|entrada/.test(c));
  const debitIdx = cols.findIndex((c) => /d[eé]bito|debit|sa[ií]da/.test(c));

  if (dateIdx === -1) return [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(sep).map((c) => c.trim().replace(/"/g, ""));
    if (parts.length < 2) continue;

    const rawDate = parts[dateIdx];
    const description = descIdx >= 0 ? parts[descIdx] : "Importado";

    let amount = 0;
    let type: "receita" | "despesa" = "despesa";

    if (creditIdx >= 0 && debitIdx >= 0) {
      const credit = parseFloat((parts[creditIdx] || "0").replace(/[^\d.,-]/g, "").replace(",", ".")) || 0;
      const debit = parseFloat((parts[debitIdx] || "0").replace(/[^\d.,-]/g, "").replace(",", ".")) || 0;
      if (credit > 0) { amount = credit; type = "receita"; }
      else { amount = Math.abs(debit); type = "despesa"; }
    } else if (valueIdx >= 0) {
      const val = parseFloat(parts[valueIdx].replace(/[^\d.,-]/g, "").replace(",", ".")) || 0;
      amount = Math.abs(val);
      type = val >= 0 ? "receita" : "despesa";
    }

    if (amount === 0 && !description) continue;

    let date = rawDate;
    const brMatch = rawDate.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
    if (brMatch) {
      date = `${brMatch[3]}-${brMatch[2]}-${brMatch[1]}`;
    }

    transactions.push({ date, description, amount, type });
  }

  return transactions;
}

async function parsePDFWithAI(fileBytes: Uint8Array): Promise<ParsedTransaction[]> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    throw new Error("LOVABLE_API_KEY not configured");
  }

  // Convert PDF bytes to base64 for the AI
  const base64 = btoa(String.fromCharCode(...fileBytes));

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content: `You are a bank statement parser. Extract all transactions from the provided PDF bank statement.
Return ONLY a valid JSON array of objects with these exact fields:
- "date": string in "YYYY-MM-DD" format
- "description": string with the transaction description
- "amount": number (always positive)
- "type": "receita" for credits/deposits/income, "despesa" for debits/withdrawals/expenses

Rules:
- Parse ALL transactions found in the document
- Convert dates from any format (dd/mm/yyyy, etc.) to YYYY-MM-DD
- Amount must always be a positive number
- Determine type based on credit/debit indicators in the statement
- Do NOT include opening/closing balances as transactions
- Return ONLY the JSON array, no markdown, no explanation`
        },
        {
          role: "user",
          content: [
            {
              type: "file",
              file: {
                filename: "statement.pdf",
                file_data: `data:application/pdf;base64,${base64}`,
              },
            },
            {
              type: "text",
              text: "Extract all transactions from this bank statement PDF. Return only the JSON array."
            }
          ],
        },
      ],
      temperature: 0,
      max_tokens: 16000,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("AI Gateway error:", errText);
    throw new Error(`AI processing failed: ${response.status}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content || "";

  // Extract JSON from the response (handle markdown code blocks)
  let jsonStr = content.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) throw new Error("Expected array");
    
    return parsed.map((t: any) => ({
      date: String(t.date || ""),
      description: String(t.description || "Sem descrição"),
      amount: Math.abs(Number(t.amount) || 0),
      type: t.type === "receita" ? "receita" as const : "despesa" as const,
    })).filter((t: ParsedTransaction) => t.amount > 0 && t.date);
  } catch (e) {
    console.error("Failed to parse AI response:", content);
    throw new Error("Não foi possível extrair transações do PDF. Tente com OFX ou CSV.");
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fileName = file.name.toLowerCase();
    let transactions: ParsedTransaction[] = [];

    if (fileName.endsWith(".pdf")) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      transactions = await parsePDFWithAI(bytes);
    } else {
      const content = await file.text();
      if (fileName.endsWith(".ofx") || fileName.endsWith(".qfx")) {
        transactions = parseOFX(content);
      } else if (fileName.endsWith(".csv") || fileName.endsWith(".txt")) {
        transactions = parseCSV(content);
      } else {
        return new Response(
          JSON.stringify({ error: "Formato não suportado. Use OFX, CSV, TXT ou PDF." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ transactions, count: transactions.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Erro ao processar arquivo: ${err.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
