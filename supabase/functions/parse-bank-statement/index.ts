import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  detected_card_digits?: string;
  cardholder_name?: string;
  statement_due_date?: string;
  statement_close_date?: string;
  statement_total?: number;
  raw_statement_date?: string;
}

function extractOFXAccountDigits(content: string): string | undefined {
  // Extract ACCTID from OFX — often contains card number or account number
  const acctMatch = content.match(/<ACCTID>\s*([^<\n]+)/i);
  if (acctMatch) {
    const acctId = acctMatch[1].trim().replace(/\D/g, "");
    if (acctId.length >= 4) {
      return acctId.slice(-4);
    }
  }
  return undefined;
}

function parseOFX(content: string): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  const accountDigits = extractOFXAccountDigits(content);
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
        ...(accountDigits ? { detected_card_digits: accountDigits } : {}),
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

  // Convert PDF bytes to base64 for the AI (chunk to avoid stack overflow)
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < fileBytes.length; i += chunkSize) {
    binary += String.fromCharCode(...fileBytes.subarray(i, i + chunkSize));
  }
  const base64 = btoa(binary);

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
          content: `You are a credit card / bank statement parser. Extract ALL purchase/expense transactions from the provided PDF.

Return ONLY a valid JSON array of transaction objects. Each object must have:
- "raw_date": string — the date EXACTLY as printed on the statement line, in "DD/MM" format. Do NOT convert or guess the year.
- "description": string with the transaction description  
- "amount": number (always positive)
- "type": "despesa" for purchases/expenses, "receita" ONLY for actual refunds/chargebacks (estornos)
- "card_digits": last 4 digits of the card this transaction belongs to (string), or null
- "cardholder_name": full name of the cardholder of this transaction (from the section header), or null
- "statement_due_date": "YYYY-MM-DD", repeated on every object, or null
- "statement_close_date": "YYYY-MM-DD", repeated on every object, or null
- "statement_total": total value of THIS statement (R$ total da fatura), repeated on every object, or null

CRITICAL RULES:
- Statements often have MULTIPLE cards/cardholders (titular + adicionais). Each section starts with a header like "NOME (final 1234)". Tag every transaction with its card_digits AND cardholder_name.
- Brazilian statements use DD/MM, NEVER MM/DD.
- DO NOT resolve the year for raw_date. The system resolves it deterministically.
- Amount must always be positive.
- For installments, the printed date is the ORIGINAL purchase date. Keep it as raw_date.

INTERNATIONAL TRANSACTIONS — VERY IMPORTANT:
- "Lançamentos internacionais" sections list purchases in USD/EUR with the converted R$ value. ALWAYS use the printed transaction date (the "DATA" of the line), NOT the closing date.
- Emit one transaction per international purchase using the R$ amount.
- ALSO emit a SEPARATE transaction for the "Repasse de IOF em R$" line — this is REAL money on the bill. Use the same date as the international purchase(s), description "IOF Internacional - <merchant>" (or just "IOF Internacional" if multiple), type "despesa". NEVER skip the IOF.

DEDUPLICATION:
- If the SAME purchase line appears twice (same date, amount, description — possibly with subtle whitespace differences), include it ONLY ONCE.

EXCLUDE (NOT real transactions):
- Bill payments: "DEB AUTOM DE FATURA", "PAGAMENTO DE FATURA", "PAG FATURA"
- Summary/header lines: "Total da fatura anterior", "Pagamento efetuado em ...", "Saldo financiado", "Lançamentos atuais"
- Section totals: "Lançamentos no cartão (final XXXX) VALOR", "Total transações inter. em R$", "Total lançamentos inter. em R$"
- Opening/closing balances, "ANUIDADE" R$ 0,00
- "Compras parceladas - próximas faturas" — this is FUTURE bills, SKIP entirely.

Only classify as "receita" real refunds/chargebacks ("ESTORNO", "DEVOLUCAO").

- Installment info ("3/6") goes inside description.
- Return ONLY the JSON array, no markdown, no wrapping object.`
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
              text: "Extract all transactions from this statement. Each transaction must include raw_date (DD/MM as printed), card_digits, statement_due_date, and statement_close_date. Return only the JSON array."
            }
          ],
        },
      ],
      temperature: 0,
      max_tokens: 65000,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("AI Gateway error:", errText);
    throw new Error(`AI processing failed: ${response.status}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content || "";
  const finishReason = result.choices?.[0]?.finish_reason || "unknown";
  console.log(`AI response: finish_reason=${finishReason}, content_length=${content.length}`);
  // Extract JSON from the response (handle markdown code blocks)
  let jsonStr = content.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    // Try to salvage truncated JSON array by finding last complete object
    const lastBrace = jsonStr.lastIndexOf("}");
    if (lastBrace > 0) {
      const salvaged = jsonStr.slice(0, lastBrace + 1) + "]";
      try {
        parsed = JSON.parse(salvaged);
        console.warn(`Salvaged truncated JSON: recovered up to position ${lastBrace}`);
      } catch {
        console.error("Failed to salvage truncated JSON");
      }
    }
    if (!parsed) {
      console.error("Failed to parse AI response:", jsonStr.slice(0, 500));
      throw new Error("Não foi possível extrair transações do PDF. Tente com OFX ou CSV.");
    }
  }

  try {
    // Support both: plain array or { transactions: [...] }
    let txArray: any[];
    if (Array.isArray(parsed)) {
      txArray = parsed;
    } else if (parsed.transactions && Array.isArray(parsed.transactions)) {
      txArray = parsed.transactions;
    } else {
      throw new Error("Expected array of transactions");
    }
    
    // Log per-card breakdown
    const cardBreakdown: Record<string, number> = {};
    txArray.forEach((t: any) => {
      const digits = t.card_digits ? String(t.card_digits) : "unknown";
      cardBreakdown[digits] = (cardBreakdown[digits] || 0) + 1;
    });
    console.log(`Parsed ${txArray.length} transactions. Cards breakdown:`, JSON.stringify(cardBreakdown));

    if (finishReason === "length") {
      console.warn("WARNING: AI response was truncated (finish_reason=length). Some transactions may be missing.");
    }

    return txArray.map((t: any) => {
      let detectedDigits: string | undefined;
      if (t.card_digits) {
        const digits = String(t.card_digits).replace(/\D/g, "");
        if (digits.length >= 4) {
          detectedDigits = digits.slice(-4);
        }
      }

      const statementDueDate = t.statement_due_date
        ? String(t.statement_due_date).match(/^\d{4}-\d{2}-\d{2}$/)?.[0]
        : undefined;

      const statementCloseDate = t.statement_close_date
        ? String(t.statement_close_date).match(/^\d{4}-\d{2}-\d{2}$/)?.[0]
        : undefined;

      // Use raw_date if available, fallback to date field
      const rawDate = t.raw_date ? String(t.raw_date).trim() : undefined;
      // If AI returned a full YYYY-MM-DD date, use it as fallback
      const dateField = String(t.date || t.raw_date || "");

      return {
        date: dateField,
        description: String(t.description || "Sem descrição"),
        amount: Math.abs(Number(t.amount) || 0),
        type: t.type === "receita" ? "receita" as const : "despesa" as const,
        ...(detectedDigits ? { detected_card_digits: detectedDigits } : {}),
        ...(statementDueDate ? { statement_due_date: statementDueDate } : {}),
        ...(statementCloseDate ? { statement_close_date: statementCloseDate } : {}),
        ...(rawDate ? { raw_statement_date: rawDate } : {}),
      };
    }).filter((t: ParsedTransaction) => t.amount > 0 && (t.date || t.raw_statement_date));
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
    // --- Auth check ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
    const message = err instanceof Error ? err.message : "erro inesperado";
    return new Response(
      JSON.stringify({ error: `Erro ao processar arquivo: ${message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
