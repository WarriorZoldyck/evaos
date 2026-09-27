# Fatura fev/2026 Santander (Paula) — divergência entre cartões

## Diagnóstico (conferido com o PDF e com os lançamentos no sistema)

| Cartão | Fatura (PDF) | Sistema | Diferença |
|---|---|---|---|
| 7014 (Paula titular) | R$ 3.931,04 | R$ 3.703,14 | falta R$ 227,90 |
| 5178 (Paula adicional) | R$ 16.012,63 | R$ 16.240,51 | sobra R$ 227,88 |
| 8021 (Vitória) | R$ 2.117,53 | R$ 2.117,53 | ok |
| 7239 (Geovanna) | R$ 599,90 | R$ 599,90 | ok |

Total bate (a diferença de R$ 0,02 é o crédito "LE BOMBOM -0,02").

Causa: a última parcela **SPAY *POLIMPORT - CO 12/12 (R$ 227,90)** pertence ao cartão **7014**, mas foi lançada no **5178** como "POLIMPORT" R$ 227,88, sem número de parcela. Por isso a fatura total bate, mas cada cartão fica errado.

## Correção proposta

Ajustar esse único lançamento (vencimento 16/02/2026):
- Cartão: 5178 → 7014
- Valor: R$ 227,88 → R$ 227,90
- Descrição: "SPAY *POLIMPORT - CO" com parcela 12/12 (igual à série anterior)

Resultado: 7014 = R$ 3.931,04 e 5178 = R$ 16.012,63, iguais ao PDF.

## Observação extra
A parcela 11/12 de janeiro aparece duas vezes (cartão 7014 e cartão 7604). Como janeiro está sendo reimportado do zero, vale conferir isso ao final.
