const apiKey = 'AIzaSyCVyJ0jlD9qzBV8IP1i99u6n-T6USg4U1M';

const CARD_SYSTEM_PROMPT = `You are a credit card / bank statement parser. Extract ALL purchase/expense transactions from the provided text.

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
- "a": positive number in REAIS with TWO DECIMAL places. Convert: "R$ 8.850,02" → 8850.02.
- "t": "d" for despesa/purchase/expense, "r" ONLY for real refunds/chargebacks/credits.
- "c": last 4 digits of the card this tx belongs to (string), or null.

CRITICAL:
- Emit "meta" ONCE. Never repeat statement dates/total/cardholder on each tx.
- Statements often have MULTIPLE cards (titular + adicionais).
- Brazilian statements use DD/MM, NEVER MM/DD.
- Amounts are always positive; sign is expressed via "t".
- meta.total MUST be a decimal number with DOT (8850.02).

EXCLUDE:
- Bill payments: "DEB AUTOM DE FATURA", "PAGAMENTO DE FATURA", "PAG FATURA"
- Section totals, "Total transações inter. em R$"
- Closing balances, ANUIDADE R$ 0,00

Return ONLY the JSON object, no markdown fences, no prose.`;

const fullText = `
PAULA REGINA SILVA SIMOES - 4258 XXXX XXXX 7014
Total a Pagar R$ 26.626,36
Vencimento 15/03/2026

Detalhamento da Fatura
PAULA R S SIMOES - 4258 XXXX XXXX 7014
Pagamento e Demais Créditos
18/02 DEB AUTOM DE FATURA EM C/ -21.167,01
Parcelamentos
15/05 IBERIA LINEA0752110558485 10/10 874,04
28/05 AMAZONA WESTERN 10/10 139,98
07/12 DROGASIL 3066 03/03 88,84
22/12 LE BOMBOM 03/03 89,96
13/01 EROS BOUTIQUE 02/03 215,90
26/01 TEIXEIRA MODA INTIMA 02/02 227,25
Despesas
09/02 LABORATORIO UNIMED RIO VE 102,00
12/02 DECIO CONVENIENCIA CEZ 16,99
14/02 CAMPEAO SUPERMERCADO 167,55
14/02 LABORATORIO UNIMED RIO VE 82,45
17/02 ADRIANAFURTADO 219,00
18/02 SCP BASICO- FEV/26 9,69
06/03 MAIS1 CAFE GO/RIO VERD 21,70
06/03 BOMBOCADO CONVEN 5 3,11
07/03 LUMA BORGES FERREIRA 62,15
09/03 ANUIDADE DIFERENCIADA 0,00
VALOR TOTAL 2.320,61

VITORIA SIMOES C MA - 4258 XXXX XXXX 8021
Parcelamentos
10/11 PEDRO VITOR MARTON GUIMAR 04/04 300,00
30/12 FAUSTO FERREIRA 03/06 895,00
07/01 PAPELBRINQ 02/10 150,80
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
20/08 AMAZONMKTPLC*FRIOVIXCO 07/10 668,78
10/09 EG*TRVL732378629 06/06 989,87
08/11 PG *CONFECCOES KA 05/06 268,12
11/11 AIRBNB * HMJ28C4 04/06 232,14
17/11 AMAZON MARKETPLACE CCI 04/04 187,43
25/11 ITALIA TRANS6055731199000 04/04 127,13
08/12 ZARA RECIFE 03/03 254,83
20/12 GLX*DISTRIBUIDORA V 03/04 1.269,79
23/12 CR SILVA BRASIL LTDA 03/03 233,00
24/12 BURALLI STORE 03/03 409,63
30/12 FLY*G3*ANUYYP 03/03 614,39
30/12 FLY*LA*LA9579209N 03/03 258,17
05/01 COOPEN 03/04 277,12
05/01 AMAZONMKTPLC*RODRIGOLU 03/04 100,76
13/01 DROGASIL 3066 02/02 92,54
16/01 AMI STORE 02/06 349,06
25/01 BRASIL PARAL*BP 02/12 59,00
29/01 BELUGA PISCINAS 02/03 416,33
29/01 TT OPERADORA TURISTICA 02/03 1.363,04
12/02 INDITEX BRASIL LTDA 01/02 189,50
12/02 INDITEX BRASIL LTDA 01/04 313,89
14/02 SOMOS FILHAS 01/02 91,18
20/02 ADRIANA REIS DE SOUZA 01/04 160,09
25/02 FARMACIA OFFICINAL 01/02 109,11
26/02 INDITEX BRASIL LTDA 01/05 496,95
03/03 PAYGO 01/02 398,00
07/03 RI HAPPY 01/03 70,00
Despesas
08/02 ADOBE 95,00
08/02 MARIADAGOVILMA 20,00
09/02 AMAZON BR 77,00
10/02 GETYOURGUIDE 237,80 EURO 1.561,66 283,65
IOF DESPESA NO EXTERIOR 54,66
10/02 GETYOURGUIDE 237,80 EURO 1.561,66 283,65
IOF DESPESA NO EXTERIOR 54,66
11/02 APPLECOMBILL 154,90
11/02 DECIO L13 150,55
11/02 MM THE PARTY LIMITED 344,25 LIBRA ESTERL 2.602,40 471,97
IOF DESPESA NO EXTERIOR 91,08
12/02 FLAMBOYANT ESTACIONAMEN 25,46
12/02 PERDOMO DOCES 121,00
12/02 BC CAFE 15,00
12/02 1524 OFFICE 20,00
12/02 FULLES KITCHEN 398,91
12/02 YMUNE ALERGO SERVICOS 600,00
13/02 MANUS AI 230,48 42,08
IOF DESPESA NO EXTERIOR 8,07
13/02 DROGASIL 3066 95,25
16/02 DROGASIL 1565 34,64
16/02 DROGASIL 1565 9,98
16/02 AMAZON DIGITAL BR 39,90
18/02 TOKIO MARINE*RESI 108,30
18/02 ADRIANAFURTADO 46,00
18/02 BONOPAO BY PANDORE 7,64
19/02 L E M ESCOVA E BELEZA 89,00
20/02 DECIO L13 169,97
20/02 DROGASIL 3066 100,64
21/02 CULINARIA ALAMBIQUE 95,49
22/02 ASAAS GESTAO*CORR 160,00
23/02 DROGASIL 4155 19,80
23/02 APPLECOMBILL 66,90
23/02 CAMPEAO SUPERMERCADO 242,77
23/02 DROGASIL 4155 41,32
24/02 VINO NATO 160,00
25/02 L E M ESCOVA E BELEZA 48,00
25/02 MV - RIO VERDE 40,70
26/02 RAIA144 18,22
26/02 NESCAFE QUALICOM 40,59
26/02 GOOGLE ONE 49,99
27/02 AMERICA MORUMBI 182,70
27/02 ZOOM COM 888-799-9666 92,53 16,99
IOF DESPESA NO EXTERIOR 3,24
28/02 APPLECOMBILL 99,90
28/02 DIMED SA-DISTRIBUIDOR 25,49
28/02 SALES C E PRODUCAO 17,00
28/02 CASARREDA 0001 62,00
28/02 DOM GALETOS GRILL LTDA 63,62
01/03 APPLECOMBILL 51,90
01/03 TAKE SUSHI 284,50
01/03 TERMINAL II OESTE 35,80
02/03 POSTO AMERICA 25,00
02/03 SABOR GOIANO RESTAURA 10,00
02/03 POSTO AMERICA 9,00
02/03 RESTAURANTE TORO 98,53
03/03 PURAVIDA 139,58
03/03 RESTAURANTE TORO 123,17
03/03 NETFLIX COM 59,90
03/03 ZIG *MANE MERCADO BS 114,97
04/03 CASA GOIANA RESTAURANTE E 9,00
04/03 RP3*ROUTE 60 SALGADOS 61,39
04/03 GOLDEN TULIP BRASILIA A 22,70
06/03 L E M ESCOVA E BELEZA 48,00
06/03 AMAZONPRIMEBR 19,90
06/03 DELICIA DO DIA LOJA 2 3,66
07/03 EBN *SPOTIFY 40,90
07/03 BURITI SHOP RIO VERDE 11,00
07/03 DECIO L13 170,47
07/03 ATELIECOSTURA 350,00
VALOR TOTAL 22.360,40

GEOVANNA S SIMOES - 4258 XXXX XXXX 7239
Despesas
10/02 RJ TECNOLOGIA AGRICOLA 300,00
10/02 DONA TITA 36,68
10/02 APPLECOMBILL 19,90
10/02 APPLECOMBILL 9,99
11/02 SANDUBAO LANCHES 32,00
11/02 GALERIA DOS PAES 22,00
11/02 LOJA DO FAMIA 20,00
12/02 DIST ZERO GRAU 42,00
12/02 SUPERMERCADO ODS 15,98
13/02 MORAES E BARROS BELEZA 89,00
14/02 DISTRIBUIDORADO 12,00
VALOR TOTAL 599,55

Resumo da Fatura
Saldo Anterior 22.661,08
(+) Total Despesas/Débitos no Brasil 20.577,63
(+) Total Despesas/Débitos no Exterior 6.048,73 1.098,34
(-) Total de pagamentos 21.167,01
(-) Total de créditos 1.494,07
(=) Saldo Desta Fatura 26.626,36
`;

async function testFull() {
  console.log("Sending full statement to Gemini 2.5 Flash with thinkingBudget: 0 ...");
  const t0 = Date.now();
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: fullText }] }],
      systemInstruction: { parts: [{ text: CARD_SYSTEM_PROMPT }] },
      generationConfig: {
        responseMimeType: "application/json",
        thinkingConfig: { thinkingBudget: 0 },
        maxOutputTokens: 24000
      }
    })
  });
  console.log("Status:", res.status, "Elapsed:", Date.now() - t0, "ms");
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    console.error("No text returned:", JSON.stringify(data, null, 2));
    return;
  }
  console.log("Finish Reason:", data.candidates?.[0]?.finishReason);
  const parsed = JSON.parse(text);
  console.log("Parsed meta:", parsed.meta);
  console.log("Parsed txs count:", parsed.txs?.length);
  
  let totalSum = 0;
  for (const t of parsed.txs || []) {
    totalSum += t.a;
  }
  console.log("Sum of all tx amounts:", totalSum.toFixed(2));
}

testFull();
