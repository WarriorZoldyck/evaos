// Public endpoint: verify_jwt = false in supabase/config.toml
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

function normalizeForRules(value: string): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isRefundLikeDescription(description: string): boolean {
  const d = normalizeForRules(description);
  return /\b(estorno|devolucao|reembolso|ressarcimento|restituicao|credito)\b/.test(d);
}

function isExcludedCardStatementLine(description: string): boolean {
  const d = normalizeForRules(description);
  return /\b(pagamento|pagto|pgto|pag)\b.*\b(fatura|cartao|cartao de credito)\b/.test(d)
    || /\bcredito\s+de\s+pagamento\b/.test(d)
    || /\bpagamento\s+recebido\b/.test(d)
    || /\bdeb(?:ito)?\s+autom(?:atico)?\s+de\s+fatura\b/.test(d)
    || /\btotal\s+(da\s+)?fatura\b/.test(d)
    || /\bsaldo\s+financiado\b/.test(d)
    || /\blancamentos\s+atuais\b/.test(d);
}

// Linhas de saldo/resumo de extrato de conta corrente — não são movimentos.
function isAccountSummaryLine(description: string): boolean {
  const d = normalizeForRules(description);
  return /^saldo\b/.test(d)
    || /\bsaldo\s+(anterior|do\s+dia|disponivel|bloqueado|em\s+conta|final|atual)\b/.test(d)
    || /\blimite\s+da\s+conta\b/.test(d)
    || /\bprovisao\s+de\s+encargos\b/.test(d)
    || /\b(juros|iof)\s+acumulados\s+ate\s+a\s+data\b/.test(d)
    || /\btotal\s+(geral|do\s+periodo)\b/.test(d);
}



function absCentsDelta(a: number, b: number): number {
  return Math.abs(Math.round(a * 100) - Math.round(b * 100));
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

function parseOFX(content: string, kind: StatementKind = "cartao"): ParsedTransaction[] {
  const transactions: ParsedTransaction[] = [];
  // Em extrato de conta corrente o ACCTID é o número da conta — nunca deve
  // virar "últimos 4 dígitos do cartão".
  const accountDigits = kind === "conta" ? undefined : extractOFXAccountDigits(content);
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

const CARD_SYSTEM_PROMPT = `You are a credit card / bank statement parser. Extract ALL purchase/expense transactions from the provided PDF.

Return ONLY a valid JSON object (no markdown, no wrapping text) with this COMPACT shape:

{
  "meta": {
    "due":   "YYYY-MM-DD" | null,   // statement due date (vencimento)
    "close": "YYYY-MM-DD" | null,   // statement close date (fechamento)
    "total": 8850.02 | null,        // total value of the bill in reais, decimal with DOT
    "cards": { "1234": "NOME TITULAR", "5678": "NOME ADICIONAL" }  // last 4 digits -> cardholder full name
  },
  "txs": [
    { "d": "DD/MM", "desc": "…", "a": 49.90, "t": "d", "c": "1234" }
  ]
}

Field rules for each tx:
- "d": date EXACTLY as printed on the line, "DD/MM". Never convert or guess the year.
- "desc": transaction description (installment info like "3/6" stays inside desc).
- "a": positive number in REAIS with TWO DECIMAL places. Brazilian statements use "." as thousand separator and "," as decimal separator. Convert: "R$ 8.850,02" → 8850.02 (NEVER 885002, NEVER 8850). "R$ 49,90" → 49.90. "R$ 100,00" → 100.00 (NEVER 10000). If you cannot see decimal places, re-read the line — the value is wrong.
- "t": "d" for despesa/purchase/expense, "r" ONLY for real refunds/chargebacks/credits that reduce the bill (ESTORNO, DEVOLUCAO, REEMBOLSO, RESTITUICAO, CREDITO). If unsure, use "d".
- "c": last 4 digits of the card this tx belongs to (string), or null.

CRITICAL:
- Emit "meta" ONCE. Never repeat statement dates/total/cardholder on each tx.
- Statements often have MULTIPLE cards (titular + adicionais). Each section header shows the name and final 4 digits — put every mapping in meta.cards and tag every tx with its "c".
- Brazilian statements use DD/MM, NEVER MM/DD.
- Amounts are always positive; sign is expressed via "t".
- meta.total MUST be a decimal number with DOT (8850.02), never with thousand separators or comma.

INTERNATIONAL TRANSACTIONS:
- "Lançamentos internacionais" sections list purchases in USD/EUR with the converted R$ value. Use the printed transaction date ("DATA" of the line), NOT the closing date.
- Emit one tx per international purchase using the R$ amount.
- ALSO emit a SEPARATE tx for the "Repasse de IOF em R$" line — real money on the bill. Same date as the international purchase(s), desc "IOF Internacional - <merchant>" (or "IOF Internacional" if multiple), t="d". NEVER skip the IOF.

PRESERVE DUPLICATES (bank statement is source of truth):
- If the SAME purchase (same date, amount, description) appears N times, emit it N times. Two identical purchases on the same day are common. NEVER collapse repeated lines.

EXCLUDE (NOT real transactions):
- Bill payments: "DEB AUTOM DE FATURA", "PAGAMENTO DE FATURA", "PAG FATURA"
- Payment/credit lines that only register paying the card bill: "PAGAMENTO RECEBIDO", "CREDITO DE PAGAMENTO", "PGTO FATURA" — do NOT emit these as txs.
- Summary/header lines: "Total da fatura anterior", "Pagamento efetuado em ...", "Saldo financiado", "Lançamentos atuais"
- Section totals, "Total transações inter. em R$", "Total lançamentos inter. em R$"
- Opening/closing balances, "ANUIDADE" R$ 0,00
- "Compras parceladas - próximas faturas" (future bills) — SKIP entirely.

Return ONLY the JSON object, no markdown fences, no prose.`;

const ACCOUNT_SYSTEM_PROMPT = `You are a BANK CHECKING ACCOUNT statement parser (extrato de conta corrente). Extract EVERY movement line from the provided PDF — both money out (débitos) and money in (créditos).

Return ONLY a valid JSON object (no markdown, no wrapping text) with this COMPACT shape:

{
  "meta": {
    "from":  "YYYY-MM-DD" | null,   // first day of the statement period ("Período: 01/01/2026 a 31/01/2026")
    "to":    "YYYY-MM-DD" | null,   // last day of the statement period
    "total": null,
    "cards": {}
  },
  "txs": [
    { "d": "DD/MM/YYYY", "desc": "…", "a": 425.00, "t": "d", "c": null }
  ]
}

Field rules for each tx:
- "d": the line's date EXACTLY as printed. Brazilian statements use DD/MM/YYYY (never MM/DD). If the year is not printed on the line, emit "DD/MM" and fill meta.from/meta.to so the year can be derived.
- "desc": the full history/description text of the line (campo Histórico / Descrição / MEMO), without the value and without the balance.
- "a": positive number in REAIS with TWO decimals. "R$ 1.613,37" → 1613.37 (NEVER 161337, NEVER 1613). "R$ 84,00" → 84.00.
- "t": "d" when the value is in the DÉBITO column (or the printed value is negative) — money leaving the account. "r" when the value is in the CRÉDITO column (or positive) — money entering the account.
- "c": ALWAYS null. This is a bank account, not a card.

CRITICAL — columns:
- These statements usually have columns: Data | Descrição | Docto | Situação | Crédito (R$) | Débito (R$) | Saldo (R$).
- The "Saldo" column is a RUNNING BALANCE — it is NOT a transaction value. NEVER use it as "a".
- Use the Crédito/Débito columns to decide both "a" and "t". If a single "Valor" column is used instead, the sign defines "t".

INCLUDE (all of these ARE real movements of the account — never skip them):
- PIX ENVIADO / PIX RECEBIDO, TED, DOC, transferências (inclusive "TRANSFERENCIA PROGRAMADA PARA: <conta>")
- PAGAMENTO DE BOLETO (qualquer banco), DEBITO AUTOMATICO, "DEBITO AUT. FATURA CARTAO ... FINAL 1234" (é uma saída real da conta)
- TARIFA / MENSALIDADE PACOTE SERVICOS, IOF, JUROS, encargos, seguros
- APLICAÇÃO e RESGATE (RESG POUP, aplicação automática), REMUNERACAO APLICACAO AUTOMATICA (mesmo R$ 0,01)
- Compras no débito, saques, depósitos, estornos

EXCLUDE (not movement lines):
- Cabeçalhos, rodapés, totalizadores e "Saldo anterior" / "Saldo do dia" / "Saldo disponível" / "Limite da conta"
- Blocos de resumo (juros acumulados, IOF acumulados, provisão de encargos)

PRESERVE DUPLICATES: if the same date + value + description appears N times, emit it N times. Never collapse repeated lines.

Return ONLY the JSON object, no markdown fences, no prose.`;

type StatementKind = "conta" | "cartao";

async function callAIGateway(
  apiKey: string,
  base64: string,
  model: string,
  maxTokens: number,
  timeoutMs: number,
  kind: StatementKind,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: kind === "conta" ? ACCOUNT_SYSTEM_PROMPT : CARD_SYSTEM_PROMPT },
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
                text: kind === "conta"
                  ? "This is a BANK CHECKING ACCOUNT statement (extrato de conta corrente). Extract every debit AND credit line into the compact { meta, txs } JSON shape. Ignore the running balance column. Emit meta once, then all txs. Return ONLY the JSON object."
                  : "Extract this statement into the compact { meta, txs } JSON shape. Emit meta once, then all txs. Return ONLY the JSON object.",
              },
            ],
          },
        ],
        temperature: 0,
        max_tokens: maxTokens,
      }),
    });
  } finally {
    clearTimeout(timer);
  }
}

async function parsePDFWithAI(fileBytes: Uint8Array, kind: StatementKind = "cartao"): Promise<ParsedTransaction[]> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    throw new Error("LOVABLE_API_KEY not configured");
  }

  // Convert PDF bytes to base64 (chunked to avoid stack overflow)
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < fileBytes.length; i += chunkSize) {
    binary += String.fromCharCode(...fileBytes.subarray(i, i + chunkSize));
  }
  const base64 = btoa(binary);

  const attempts: Array<{ model: string; maxTokens: number; timeoutMs: number }> = [
    { model: "google/gemini-3-flash-preview", maxTokens: 24000, timeoutMs: 70_000 },
    { model: "google/gemini-2.5-pro", maxTokens: 32000, timeoutMs: 90_000 },
  ];

  let lastError: unknown = null;
  for (let i = 0; i < attempts.length; i++) {
    const { model, maxTokens, timeoutMs } = attempts[i];
    console.log(`Calling AI Gateway model=${model} max_tokens=${maxTokens} timeout=${timeoutMs}ms`);
    let response: Response;
    const startedAt = Date.now();
    try {
      response = await callAIGateway(apiKey, base64, model, maxTokens, timeoutMs, kind);
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === "AbortError";
      console.error(`AI Gateway ${model} ${aborted ? "timed out" : "failed"} after ${Date.now() - startedAt}ms:`, err);
      lastError = aborted
        ? new Error(`O modelo demorou demais para processar o extrato (${model}).`)
        : err;
      continue;
    }

    if (!response.ok) {
      const errText = await response.text();
      console.error(`AI Gateway ${model} error ${response.status}:`, errText.slice(0, 500));
      if (response.status === 429 || response.status === 402) {
        throw new Error(
          response.status === 402
            ? "Créditos de IA esgotados. Adicione créditos ou tente novamente mais tarde."
            : "Muitas requisições. Aguarde alguns segundos e tente novamente.",
        );
      }
      lastError = new Error(`AI processing failed: ${response.status}`);
      continue;
    }

    try {
      const parsed = await parseAIResponse(await response.json(), kind);
      console.log(`Model ${model} produced ${parsed.length} transactions in ${Date.now() - startedAt}ms`);
      if (parsed.length > 0) return parsed;
      if (i === attempts.length - 1) return parsed;
      console.warn(`Model ${model} returned 0 transactions — trying fallback.`);
    } catch (err) {
      console.error(`Failed to parse ${model} response:`, err);
      lastError = err;
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error("Não foi possível extrair transações do PDF. Tente com OFX ou CSV.");
}


async function parseAIResponse(result: any, kind: StatementKind = "cartao"): Promise<ParsedTransaction[]> {
  const content = result.choices?.[0]?.message?.content || "";
  const finishReason = result.choices?.[0]?.finish_reason || "unknown";
  console.log(`AI response: finish_reason=${finishReason}, content_length=${content.length}`);
  let jsonStr = content.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1].trim();
  }
  return parseTxJson(jsonStr, finishReason, kind);
}

function parseTxJson(jsonStr: string, finishReason: string, kind: StatementKind = "cartao"): ParsedTransaction[] {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    // Salvage truncated JSON — close open array/object heuristically.
    const lastBrace = jsonStr.lastIndexOf("}");
    if (lastBrace > 0) {
      // Try to close as { meta, txs: [ ... ] } first, then as bare array.
      const candidates = [
        jsonStr.slice(0, lastBrace + 1) + "]}",
        jsonStr.slice(0, lastBrace + 1) + "]",
        jsonStr.slice(0, lastBrace + 1) + "}",
      ];
      for (const c of candidates) {
        try { parsed = JSON.parse(c); console.warn(`Salvaged truncated JSON via candidate len=${c.length}`); break; } catch { /* try next */ }
      }
    }
    if (!parsed) {
      console.error("Failed to parse AI response:", jsonStr.slice(0, 500));
      throw new Error("Não foi possível extrair transações do PDF. Tente com OFX ou CSV.");
    }
  }

  try {
    // Detect shape:
    // 1) NEW compact: { meta: {...}, txs: [...] }
    // 2) Legacy: array of full-shaped tx objects
    // 3) Legacy: { transactions: [...] }
    let txArray: any[];
    let meta: any = null;

    if (Array.isArray(parsed)) {
      txArray = parsed;
    } else if (parsed && Array.isArray(parsed.txs)) {
      meta = parsed.meta || null;
      txArray = parsed.txs;
    } else if (parsed && Array.isArray(parsed.transactions)) {
      txArray = parsed.transactions;
    } else {
      throw new Error("Expected { meta, txs } or array of transactions");
    }

    const isAccount = kind === "conta";
    const isoRe = /^\d{4}-\d{2}-\d{2}$/;
    const metaFrom: string | undefined = meta?.from && isoRe.test(String(meta.from)) ? String(meta.from) : undefined;
    const metaTo: string | undefined = meta?.to && isoRe.test(String(meta.to)) ? String(meta.to) : undefined;

    // Normaliza a data de uma linha de extrato de conta para ISO.
    // Aceita DD/MM/AAAA, DD/MM/AA, AAAA-MM-DD e DD/MM (usa o período do extrato).
    const normalizeAccountDate = (raw: string): string | undefined => {
      const s = (raw || "").trim();
      if (!s) return undefined;
      if (isoRe.test(s)) return s;
      const full = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
      if (full) {
        let y = Number(full[3]);
        if (y < 100) y += 2000;
        return `${y}-${String(Number(full[2])).padStart(2, "0")}-${String(Number(full[1])).padStart(2, "0")}`;
      }
      const dm = s.match(/^(\d{1,2})[\/.-](\d{1,2})$/);
      if (!dm) return undefined;
      const day = Number(dm[1]);
      const month = Number(dm[2]);
      const refIso = metaTo || metaFrom;
      const refYear = refIso ? Number(refIso.slice(0, 4)) : new Date().getFullYear();
      const build = (y: number) => `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      let iso = build(refYear);
      if (metaFrom && metaTo) {
        const ms = (a: string) => new Date(a + "T00:00:00").getTime();
        const tolerance = 75 * 86400000;
        if (ms(iso) > ms(metaTo) + tolerance) iso = build(refYear - 1);
        else if (ms(iso) < ms(metaFrom) - tolerance) iso = build(refYear + 1);
      }
      return iso;
    };

    const metaDue: string | undefined = meta?.due && /^\d{4}-\d{2}-\d{2}$/.test(meta.due) ? meta.due : undefined;
    const metaClose: string | undefined = meta?.close && /^\d{4}-\d{2}-\d{2}$/.test(meta.close) ? meta.close : undefined;
    let metaTotal: number | undefined;
    if (meta?.total !== undefined && meta?.total !== null && meta?.total !== "") {
      const n = Number(String(meta.total).replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", "."));
      if (Number.isFinite(n) && n > 0) metaTotal = n;
    }
    const metaCards: Record<string, string> = {};
    if (meta?.cards && typeof meta.cards === "object") {
      for (const [k, v] of Object.entries(meta.cards)) {
        const digits = String(k).replace(/\D/g, "").slice(-4);
        if (digits.length === 4 && typeof v === "string" && v.trim()) {
          metaCards[digits] = String(v).trim();
        }
      }
    }

    // Per-card breakdown
    const cardBreakdown: Record<string, number> = {};
    txArray.forEach((t: any) => {
      const digits = (t.c || t.card_digits) ? String(t.c || t.card_digits) : "unknown";
      cardBreakdown[digits] = (cardBreakdown[digits] || 0) + 1;
    });
    console.log(`Parsed ${txArray.length} transactions. Cards breakdown:`, JSON.stringify(cardBreakdown));

    if (finishReason === "length") {
      console.warn("WARNING: AI response was truncated (finish_reason=length). Some transactions may be missing.");
    }

    return txArray.map((t: any) => {
      // Compact fields (d/desc/a/t/c) take precedence, fall back to legacy field names.
      // Em extrato de conta NUNCA inferimos cartão — "FINAL 7014" no histórico
      // é apenas texto, não destino do lançamento.
      const rawCard = isAccount ? null : (t.c ?? t.card_digits);
      let detectedDigits: string | undefined;
      if (rawCard) {
        const digits = String(rawCard).replace(/\D/g, "");
        if (digits.length >= 4) detectedDigits = digits.slice(-4);
      }

      const rawTypeStr = String(t.t ?? t.type ?? "d").toLowerCase();
      let isReceita = rawTypeStr === "r" || rawTypeStr === "receita";

      const rawDate = t.d ? String(t.d).trim() : (t.raw_date ? String(t.raw_date).trim() : undefined);
      let dateField = String(t.date || rawDate || "");
      if (isAccount) {
        dateField = normalizeAccountDate(dateField) || "";
      }

      // Fallbacks for legacy per-tx statement fields (if AI ignored meta).
      const statementDueDate = isAccount ? undefined : (metaDue ?? (t.statement_due_date && /^\d{4}-\d{2}-\d{2}$/.test(String(t.statement_due_date)) ? String(t.statement_due_date) : undefined));
      const statementCloseDate = isAccount ? undefined : (metaClose ?? (t.statement_close_date && /^\d{4}-\d{2}-\d{2}$/.test(String(t.statement_close_date)) ? String(t.statement_close_date) : undefined));
      let statementTotal = isAccount ? undefined : metaTotal;
      if (!isAccount && statementTotal === undefined && t.statement_total !== undefined && t.statement_total !== null && t.statement_total !== "") {
        const n = Number(String(t.statement_total).replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", "."));
        if (Number.isFinite(n) && n > 0) statementTotal = n;
      }
      const cardholderName = isAccount
        ? undefined
        : ((detectedDigits && metaCards[detectedDigits])
          || (t.cardholder_name ? String(t.cardholder_name).trim() : undefined));

      const amount = Math.abs(Number(t.a ?? t.amount) || 0);
      const description = String(t.desc ?? t.description ?? "Sem descrição");

      if (isReceita) {
        console.log(`Receita/credit detected: desc="${description.slice(0, 120)}" amount=${amount} card=${detectedDigits || "unknown"}`);
      }

      return {
        date: dateField,
        description,
        amount,
        type: isReceita ? "receita" as const : "despesa" as const,
        ...(detectedDigits ? { detected_card_digits: detectedDigits } : {}),
        ...(cardholderName ? { cardholder_name: cardholderName } : {}),
        ...(statementDueDate ? { statement_due_date: statementDueDate } : {}),
        ...(statementCloseDate ? { statement_close_date: statementCloseDate } : {}),
        ...(statementTotal ? { statement_total: statementTotal } : {}),
        ...(rawDate ? { raw_statement_date: rawDate } : {}),
      };
    }).filter((t: ParsedTransaction) => {
      if (isAccount) {
        // Em conta corrente só descartamos linhas de saldo/resumo — tarifas,
        // IOF, boletos, débito de fatura e transferências são movimentos reais.
        if (isAccountSummaryLine(t.description)) {
          console.log(`Excluded account summary line: desc="${t.description.slice(0, 120)}" amount=${t.amount}`);
          return false;
        }
        return t.amount > 0 && !!t.date;
      }
      if (isExcludedCardStatementLine(t.description)) {
        console.log(`Excluded non-transaction statement line: desc="${t.description.slice(0, 120)}" amount=${t.amount}`);
        return false;
      }
      return t.amount > 0 && (t.date || t.raw_statement_date);
    });
  } catch (e) {
    console.error("Failed to parse AI response:", jsonStr.slice(0, 500));
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
    const rawKind = String(formData.get("statementKind") || formData.get("importType") || "cartao").toLowerCase();
    const statementKind: StatementKind = (rawKind === "conta" || rawKind === "debito" || rawKind === "banco") ? "conta" : "cartao";
    console.log(`Parsing ${fileName} as statementKind=${statementKind}`);
    let transactions: ParsedTransaction[] = [];

    if (fileName.endsWith(".pdf")) {
      const bytes = new Uint8Array(await file.arrayBuffer());
      transactions = await parsePDFWithAI(bytes, statementKind);
    } else {
      const content = await file.text();
      if (fileName.endsWith(".ofx") || fileName.endsWith(".qfx")) {
        transactions = parseOFX(content, statementKind);
      } else if (fileName.endsWith(".csv") || fileName.endsWith(".txt")) {
        transactions = parseCSV(content);
      } else {
        return new Response(
          JSON.stringify({ error: "Formato não suportado. Use OFX, CSV, TXT ou PDF." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    let statementTotal = transactions.find((t) => t.statement_total !== undefined)?.statement_total ?? null;
    let amountRescaled = false;

    // Integer-cents helper to avoid floating-point drift on long sums.
    const toCents = (n: number) => Math.round(n * 100);
    const fromCents = (c: number) => Math.round(c) / 100;

    // Heuristic: detect when the AI returned all amounts multiplied by 100
    // (i.e. read "R$ 8.850,02" as 885002 instead of 8850.02 by dropping the
    // decimal separator). If the majority of amounts are integers > 100 with
    // no decimal part, OR if the statement_total is ~100× smaller than the
    // sum of lines, divide all amounts by 100.
    if (transactions.length > 0) {
      const total = transactions.length;
      const integerBig = transactions.filter(
        (t) => t.amount > 100 && Number.isInteger(t.amount)
      ).length;
      const integerRatio = integerBig / total;

      let shouldRescale = false;
      let reason = "";

      // Signal 1: statement_total is sane but sum of lines is ~100× bigger
      if (statementTotal !== null) {
        const sumAmounts = transactions.reduce((acc, t) => acc + (t.amount || 0), 0);
        if (sumAmounts > 0 && sumAmounts > statementTotal * 50 && sumAmounts < statementTotal * 200) {
          shouldRescale = true;
          reason = `sum=${sumAmounts.toFixed(2)} ~100× statement_total=${statementTotal}`;
        }
      }

      // Signal 2: 70%+ of amounts are integers > 100 (no decimals at all)
      if (!shouldRescale && integerRatio >= 0.7) {
        shouldRescale = true;
        reason = `${integerBig}/${total} amounts are integers > 100 (${(integerRatio * 100).toFixed(0)}%) — AI likely dropped decimals`;
      }

      if (shouldRescale) {
        console.warn(`Rescaling amounts /100: ${reason}`);
        transactions = transactions.map((t) => ({
          ...t,
          amount: Math.round((t.amount / 100) * 100) / 100,
          ...(t.statement_total ? { statement_total: t.statement_total } : {}),
        }));
        amountRescaled = true;
      }
    }

    const parsedGrossCentsBeforeStatementCheck = transactions.reduce(
      (acc, t) => acc + toCents(Math.abs(t.amount || 0)),
      0,
    );
    const parsedNetCentsBeforeStatementCheck = transactions.reduce(
      (acc, t) => acc + (t.type === "receita" ? -toCents(Math.abs(t.amount || 0)) : toCents(Math.abs(t.amount || 0))),
      0,
    );

    // Sanity check: if the AI returned a statement_total that's clearly out of scale
    // vs. the net/gross line totals, try to rescale (~100× is a dropped decimal separator);
    // only discard when it's still implausible after the rescale attempt.
    if (statementTotal !== null) {
      const grossTotal = fromCents(parsedGrossCentsBeforeStatementCheck);
      const netTotal = Math.abs(fromCents(parsedNetCentsBeforeStatementCheck));
      const comparisonTotal = netTotal > 0 ? netTotal : grossTotal;
      const ratio = comparisonTotal > 0 ? statementTotal / comparisonTotal : 0;
      console.log(
        `Statement total check: statement_total=${statementTotal} gross=${grossTotal.toFixed(2)} net=${netTotal.toFixed(2)} ratio=${ratio.toFixed(2)}`
      );
      if (comparisonTotal > 0 && statementTotal > comparisonTotal * 20) {
        // Mirror of Signal 1: statement_total ~100× the sum of lines => dropped decimals
        if (statementTotal >= comparisonTotal * 30 && statementTotal <= comparisonTotal * 300) {
          const rescaled = Math.round(statementTotal) / 100;
          console.warn(
            `Rescaled statement_total /100: was=${statementTotal} now=${rescaled.toFixed(2)} (gross=${grossTotal.toFixed(2)} net=${netTotal.toFixed(2)})`
          );
          statementTotal = rescaled;
        } else {
          console.warn(
            `Discarding implausible statement_total=${statementTotal} (gross=${grossTotal.toFixed(2)}, net=${netTotal.toFixed(2)}, ratio=${ratio.toFixed(1)}x)`
          );
          statementTotal = null;
        }
      }
    }

    // Credit-card statements sometimes expose a credit/restitution/adjustment line that
    // is already reflected in the bank's final total. If we import it as "receita", the
    // bill gets discounted twice (exactly the R$519,33 scenario). Use the bank total as
    // source of truth to decide whether credit lines should stay, be excluded, or be
    // treated as normal expenses.
    if (statementTotal !== null && transactions.some((t) => t.type === "receita")) {
      const credits = transactions.filter((t) => t.type === "receita");
      const expenseOnlyTotal = transactions.reduce(
        (sum, t) => sum + (t.type === "despesa" ? Math.abs(t.amount || 0) : 0),
        0,
      );
      const netTotal = Math.abs(transactions.reduce(
        (sum, t) => sum + (t.type === "receita" ? -Math.abs(t.amount || 0) : Math.abs(t.amount || 0)),
        0,
      ));
      const grossTotal = transactions.reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);
      const toleranceCents = 150;

      if (absCentsDelta(netTotal, statementTotal) <= toleranceCents) {
        console.log(
          `Keeping credit lines: net total matches statement (net=${netTotal.toFixed(2)}, statement=${statementTotal.toFixed(2)}, credits=${credits.length})`
        );
      } else if (absCentsDelta(expenseOnlyTotal, statementTotal) <= toleranceCents) {
        console.warn(
          `Excluding ${credits.length} credit/adjustment line(s): expenses-only total matches statement (expenses=${expenseOnlyTotal.toFixed(2)}, net=${netTotal.toFixed(2)}, gross=${grossTotal.toFixed(2)}, statement=${statementTotal.toFixed(2)})`
        );
        console.warn(
          `Excluded credit/adjustment lines: ${JSON.stringify(credits.map((t) => ({ desc: t.description.slice(0, 100), amount: t.amount, card: t.detected_card_digits })))} `
        );
        transactions = transactions.filter((t) => t.type !== "receita");
      } else if (absCentsDelta(grossTotal, statementTotal) <= toleranceCents) {
        console.warn(
          `Converting ${credits.length} AI-marked receita line(s) to despesa: gross total matches statement (gross=${grossTotal.toFixed(2)}, net=${netTotal.toFixed(2)}, statement=${statementTotal.toFixed(2)})`
        );
        transactions = transactions.map((t) => t.type === "receita" ? { ...t, type: "despesa" } : t);
      } else {
        const nonExplicitCredits = credits.filter((t) => !isRefundLikeDescription(t.description));
        if (nonExplicitCredits.length > 0) {
          console.warn(
            `Credit lines did not reconcile with statement and lack explicit refund wording: ${JSON.stringify(nonExplicitCredits.map((t) => ({ desc: t.description.slice(0, 100), amount: t.amount })))} `
          );
        }
      }
    }

    // Final tallies in INTEGER CENTS to avoid float drift on long sums.
    const parsedGrossTotalCents = transactions.reduce(
      (acc, t) => acc + toCents(Math.abs(t.amount || 0)),
      0,
    );
    const parsedNetTotalCents = transactions.reduce(
      (acc, t) => acc + (t.type === "receita" ? -toCents(Math.abs(t.amount || 0)) : toCents(Math.abs(t.amount || 0))),
      0,
    );
    const statementTotalCents = statementTotal !== null ? toCents(statementTotal) : null;
    const parsedNetAbsCents = Math.abs(parsedNetTotalCents);
    const diffCents = statementTotalCents !== null ? parsedNetAbsCents - statementTotalCents : null;
    const creditLines = transactions.filter((t) => t.type === "receita");
    const topLines = [...transactions]
      .sort((a, b) => Math.abs(b.amount || 0) - Math.abs(a.amount || 0))
      .slice(0, 8)
      .map((t) => `${t.type}:${(t.amount || 0).toFixed(2)}:${t.description.slice(0, 60)}`);
    console.log(
      `Final totals: statement=${statementTotal ?? "null"} gross=${fromCents(parsedGrossTotalCents).toFixed(2)} net=${fromCents(parsedNetTotalCents).toFixed(2)} diff_cents=${diffCents ?? "null"} credits=${creditLines.length}`
    );
    if (creditLines.length > 0) {
      console.log(`Credit/refund lines: ${JSON.stringify(creditLines.map((t) => ({ desc: t.description.slice(0, 100), amount: t.amount, card: t.detected_card_digits })))} `);
    }
    console.log(`Top parsed lines: ${JSON.stringify(topLines)}`);

    return new Response(
      JSON.stringify({
        transactions,
        count: transactions.length,
        statement_total: statementTotal,
        statement_total_cents: statementTotalCents,
        parsed_total: fromCents(parsedNetAbsCents),
        parsed_total_cents: parsedNetAbsCents,
        parsed_net_total: fromCents(parsedNetTotalCents),
        parsed_net_total_cents: parsedNetTotalCents,
        parsed_gross_total: fromCents(parsedGrossTotalCents),
        parsed_gross_total_cents: parsedGrossTotalCents,
        diff_cents: diffCents,
        amount_rescaled: amountRescaled,
      }),
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
