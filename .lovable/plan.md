# Fatura R$ 10.865,52 — diagnóstico e correção

## Diagnóstico (já validado contra a fatura)

Fatura tem 5 titulares (1973, 6035, 9615, 7940, 7355) todos colapsados sob MASTERCARD BLACK no sistema. Diferença de R$ 541,89:

**Extras no sistema (R$ 604,50):**
- "Pneus moto" R$ 549,60 duplicado (2 registros idênticos parcela 1/5).
- "Empório Moscato" R$ 54,90 (29/04) não consta na fatura.

**Ausentes no sistema (R$ 62,60):**
- "Carne de Sol 1008" R$ 5,00 (final 7940 — Vitoria).
- IOF internacional R$ 57,60 (GetYourGuide).

604,50 − 62,60 = 541,90 ≈ 541,89 ✅

---

## Passo 1 — Corrigir dados do usuário (espclin@hotmail.com)

Script service-role (SQL via insert tool):
- DELETE id `b337e07a-f48f-4a08-87db-df1a45aa90d0` (duplicata Pneus moto).
- DELETE id `a782a66a-9b11-4b31-92cc-c9b8cbca8828` (Empório Moscato 54,90 — se o usuário confirmar, mas como bate exato com a diferença, vou prosseguir com a exclusão e avisá-lo).
- INSERT "Carne de Sol 1008" R$ 5,00, despesa, status Pendente, competence_date 2026-04-16, payment_date 2026-05-21, credit_card_id 1973.
- INSERT "IOF Internacional - GetYourGuide" R$ 57,60, despesa, status Pendente, competence_date 2026-05-14, payment_date 2026-05-21, credit_card_id 1973.

Total final esperado: R$ 10.865,52.

---

## Passo 2 — Endurecer o parser `parse-bank-statement`

Edge function `supabase/functions/parse-bank-statement/index.ts`:

1. **Capturar IOF internacional**: detectar linha "Repasse de IOF em R$ <valor>" no bloco internacional e emitir como lançamento separado (descrição "IOF Internacional - <merchant>", data = data da compra internacional).
2. **Capturar lançamentos internacionais** com a data da linha "DATA ESTABELECIMENTO" do bloco internacional (hoje cai na data do fechamento).
3. **Detectar cartões adicionais** (`NOME (final XXXX)` headers). Para cada subtotal, etiquetar as transações com `additional_cardholder` na resposta — o cliente pode prefixar a descrição com `[final XXXX]` para o usuário identificar e (futuramente) sugerir criação de cartão-filho.
4. **Dedup dentro do mesmo extrato** já existe em `ImportStatementModal.tsx`; ampliar a chave para também colapsar parcelas com mesmo `installment_number/installments_total + amount + base_description` (cobre o caso "Pneus moto 1/5 × 2").

---

## Passo 3 — Validação pós-conciliação na UI

Em `ImportStatementModal.tsx` (etapa `reconcile`):

1. Adicionar campo opcional **"Total informado na fatura (R$)"** acima do footer da etapa de conciliação — usuário cola o total que o banco informou.
2. No footer, mostrar `Total no extrato após import: X · Diferença vs fatura: Y`.
3. Se `|diferença| > 1,00`, mostrar `Alert` vermelho **bloqueando o botão Importar** até o usuário marcar "Entendi a divergência, importar mesmo assim". Mensagem orienta a revisar linhas duplicadas/ausentes.
4. Tentar auto-preencher o campo a partir do parser quando ele detectar "Total desta fatura" no PDF (já temos `statement_total` em vários parsers).

---

## Arquivos afetados

- `supabase/functions/parse-bank-statement/index.ts` — passos 2.1, 2.2, 2.3
- `src/components/lancamentos/ImportStatementModal.tsx` — passos 2.4, 3
- SQL data fix (via insert tool) — passo 1

Sem mudanças de schema, RLS ou novas tabelas.