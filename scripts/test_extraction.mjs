const apiKey = 'AIzaSyCVyJ0jlD9qzBV8IP1i99u6n-T6USg4U1M';

const CARD_SYSTEM_PROMPT = `You are a credit card / bank statement parser. Extract ALL purchase/expense transactions from the provided text.

Return ONLY a valid JSON object (no markdown, no wrapping text) with this COMPACT shape:

{
  "meta": {
    "due":   "YYYY-MM-DD" | null,
    "close": "YYYY-MM-DD" | null,
    "total": 8850.02 | null,
    "cards": { "1234": "NOME TITULAR", "5678": "NOME ADICIONAL" }
  },
  "txs": [
    { "d": "DD/MM", "desc": "…", "a": 49.90, "t": "d", "c": "1234" }
  ]
}

Field rules for each tx:
- "d": date EXACTLY as printed on the line, "DD/MM".
- "desc": transaction description.
- "a": positive number in REAIS with TWO DECIMAL places. Convert: "R$ 8.850,02" → 8850.02.
- "t": "d" for despesa/purchase/expense, "r" ONLY for real refunds/chargebacks/credits.
- "c": last 4 digits of the card this tx belongs to (string), or null.
`;

const sampleText = `
Olá, Paula! Esta é a fatura do seu cartão SANTANDER UNIQUE VISA
Vencimento 15/03/2026 Total a Pagar R$ 26.626,36
PAULA REGINA SILVA SIMOES - 4258 XXXX XXXX 7014
Detalhamento da Fatura
PAULA R S SIMOES - 4258 XXXX XXXX 7014
Pagamento e Demais Créditos
18/02 DEB AUTOM DE FATURA EM C/ -21.167,01
Parcelamentos
15/05 IBERIA LINEA0752110558485 10/10 874,04
28/05 AMAZONA WESTERN 10/10 139,98
07/12 DROGASIL 3066 03/03 88,84
Despesas
09/02 LABORATORIO UNIMED RIO VE 102,00
12/02 DECIO CONVENIENCIA CEZ 16,99
14/02 CAMPEAO SUPERMERCADO 167,55
VALOR TOTAL 2.320,61

VITORIA SIMOES C MA - 4258 XXXX XXXX 8021
10/11 PEDRO VITOR MARTON GUIMAR 04/04 300,00
30/12 FAUSTO FERREIRA 03/06 895,00
VALOR TOTAL 1.345,80

@ PAULA R S SIMOES - 4258 XXXX XXXX 5178
Pagamento e Demais Créditos
30/04 APPLE COM/BILL -33,53
16/01 AMI STORE -0,03
10/02 GETYOURGUIDE 237,80 EURO -1.460,51 -280,77
Parcelamentos
04/06 PG *AGRO+LEAN 10/10 275,00
14/07 EDZ 08/12 129,68
20/08 MAGALU*MAGALU 07/10 192,43
Despesas
08/02 ADOBE 95,00
08/02 MARIADAGOVILMA 20,00
10/02 GETYOURGUIDE 237,80 EURO 1.561,66 283,65
IOF DESPESA NO EXTERIOR 54,66
`;

async function run() {
  console.log("Testing with thinkingBudget: 0 ...");
  const t0 = Date.now();
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: sampleText }] }],
      systemInstruction: { parts: [{ text: CARD_SYSTEM_PROMPT }] },
      generationConfig: {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
      }
    })
  });
  console.log("Status:", res.status, "Elapsed:", Date.now() - t0, "ms");
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  console.log("Parsed JSON preview:", text?.slice(0, 300));
}

run();
