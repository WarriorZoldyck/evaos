## Plano final — Importação de Extrato (incorpora as 3 ponderações)

Aprovado com os ajustes que você apontou. Versão final consolidada abaixo.

---

### Diagnóstico (já confirmado no banco)

- PDF `Black_junho.pdf`: 58 linhas, total R$ 8.850,02.
- Fatura jun/2026 do MASTERCARD BLACK no banco: 71 linhas / R$ 12.699,57.
  - 15 vieram da importação real de 22/06 11:44
  - 55 são "⚠️ RECUPERAÇÃO EVA — CONFERIR" criados em 19/06 (ghosts)
  - 1 compra manual de 16/06

A importação funcionou (gravou 15), mas os 55 ghosts mascaram o resultado e fizeram o reconciliador silenciar as 43 linhas restantes.

---

### 1. Reatividade pós-importação

- Em `ImportStatementModal.onSuccess`: invalidar `['transactions']`, `['credit-card-usage']`, `['account-balance']`, `['bills']`.
- Edge function devolve `{ inserted, linked, skipped, parsed_total }`. Toast detalhado: *"X criados · Y vinculados · Z ignorados — total importado R$ ___"*.
- Se `inserted + linked < parsed_count`, abrir `AlertDialog` em vez de fechar direto.

### 2. Anti-duplicação — sem trava cega no banco (sua ponderação aplicada)

**Sem `UNIQUE INDEX` global.** Duas compras idênticas no mesmo dia/lugar são lícitas.

- **Detecção no front (`ReconcileStep`)**: agrupar linhas exatas do PDF e perguntar:
  *"Encontramos 2 transações idênticas (R$ 25,00 — Italyansorvetes — 06/06). Importar ambas ou apenas uma?"*
- **Detecção contra existentes**: no matcher, se houver lançamento já existente com mesma `(data, valor, descNormalizada)` e o usuário escolher "Importar como novo", mostrar aviso inline *"Já existe um lançamento idêntico. Confirmar nova entrada?"* — não bloqueia, só confirma.
- **Limpeza pontual dos ghosts** (após confirmação do Renato): SQL admin soft-delete dos 55 com `description ILIKE '%RECUPERAÇÃO EVA%'`, `series_id IS NULL`, `created_at::date = '2026-06-19'`.
- **Auditoria global**: levantar quantos outros usuários têm o prefixo `RECUPERAÇÃO EVA` e localizar/desativar o script que originou o batch.

### 3. Cálculo em centavos (sua ponderação aplicada)

- Em `parse-bank-statement` (Edge): toda soma e validação feita em **inteiros (centavos)**: `Math.round(amount * 100)`. Divisão por 100 só na hora de devolver o JSON pro front.
- Devolver no payload: `parsed_total_cents`, `statement_total_cents`, `diff_cents`.
- No modal exibir três números: **Banco: X · Parser: Y · Selecionado: Z**. Se `Y != X`, badge vermelho *"Divergência de R$ N — revisar linhas"* + botão para listar o delta.
- Garantir que o IOF internacional e demais linhas "internacional em R$" entrem na soma (causa provável da diferença de ~R$ 25 que você viu).

### 4. UX da reconciliação (renomes)

| Atual | Novo |
|---|---|
| "Manter" | **"Importar como novo"** |
| "Ignorar" | **"Já existe — não importar"** |
| "Vincular" | **"Casar com lançamento existente"** |
| "Conciliar todos os pares" | **"Casar automaticamente os pares sugeridos"** |
| "Importar X como projetados" | **"Importar X lançamentos para a fatura de Jun/26"** |

- Legenda fixa no topo: *"Cada linha do extrato vira uma ação. Revise antes de confirmar."*
- Resumo antes do botão final: *"Você vai: criar X · casar Y · descartar Z. Total a entrar: R$ ___"*.

### 5. Performance e loading (sua ponderação aplicada)

- **Sem streaming/SSE.** Mantém a chamada única à Edge.
- **Skeleton da tabela de reconciliação** com ~10 linhas fantasmas durante o processamento.
- Legenda destacada: *"Analisando PDF com IA — pode levar até 40s em faturas grandes…"*.
- No `useImportMatching`: limitar `select` apenas às colunas necessárias e garantir índice em `transactions (credit_card_id, competence_date)` se ainda não existir.

---

### Arquivos a alterar

- `supabase/functions/parse-bank-statement/index.ts` — somas em centavos, retornar `parsed_total_cents`/`diff_cents`, contagem esperada.
- `src/components/lancamentos/ImportStatementModal.tsx` — invalidar queries, toast detalhado, AlertDialog em divergência, skeleton de loading.
- `src/components/lancamentos/import/ReconcileStep.tsx` — renomes, legendas, resumo final, aviso de duplicatas no próprio PDF, confirmação ao importar como novo contra existente idêntico.
- `src/hooks/useImportMatching.ts` — similaridade de descrição (Jaro-Winkler ≥ 0.6) além de valor+data.
- **Migration**: apenas índice de performance `CREATE INDEX IF NOT EXISTS idx_transactions_card_competence ON public.transactions (credit_card_id, competence_date)`. **Nenhum índice único.**
- **SQL admin pontual** (insert tool, após confirmação): soft-delete dos 55 ghosts da fatura.

### Checklist de validação

1. Reimportar `Black_junho.pdf` após limpeza → 58 lançamentos, R$ 8.850,02, zero ghosts.
2. Modal mostra `Banco: 8.850,02 · Parser: 8.850,02 · Selecionado: 8.850,02`.
3. Importar PDF com duas linhas idênticas → modal pergunta *"Importar ambas ou apenas uma?"*.
4. Reimportar o mesmo PDF → matcher identifica todos como já existentes, nenhuma duplicata silenciosa criada.
5. F5 após importar → contagem e total atualizados imediatamente na lista do cartão.
6. Busca global por `RECUPERAÇÃO EVA` → 0 resultados após cleanup.

Posso seguir para a implementação?
