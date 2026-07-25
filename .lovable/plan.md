
## 1. Toggle "Ignorar / Criar" — rótulos fixos nas laterais corretas

Em `src/components/lancamentos/import/ReconcileStep.tsx`, célula de ação da tabela "Só no extrato":

- Rótulo **"Ignorar"** sempre à **esquerda** do `NeuToggle`.
- Rótulo **"Criar"** sempre à **direita** do `NeuToggle`.
- Destaque visual do lado ativo (Ignorar em cinza quando off, Criar em cor primary quando on); o lado inativo fica atenuado. Nenhum outro elemento do layout muda.
- Mapeamento mantido: toggle ligado = `criar`, desligado = `ignorar`.

## 2. Corrigir leitura do total da fatura no parser

Logs de `parse-bank-statement` mostram uma fatura em que a soma das linhas era R$ 23.180,45 e o `statement_total` retornado pela IA foi `2266108` (ou seja, R$ 22.661,08 lido sem a vírgula decimal). Hoje esse caso cai no bloco "Discarding implausible statement_total" (linhas 522–532 de `supabase/functions/parse-bank-statement/index.ts`) e o total é jogado fora, o que quebra a conferência no modal e a base do "Total do banco".

Correção em `supabase/functions/parse-bank-statement/index.ts`:

- Adicionar sinal simétrico ao rescaling: se `statementTotal` é ~100× a soma das linhas (razão entre 50× e 200×), dividir `statementTotal` por 100 antes de considerá-lo, em vez de descartar.
- Só descartar (comportamento atual) quando a razão continuar fora de escala mesmo após a tentativa de reescalar.
- Log claro: "Rescaled statement_total /100: was=X now=Y (sum=Z)".
- Nenhuma mudança na leitura das linhas individuais — o Signal 2 existente (70% de inteiros grandes) já cobre esses casos.

## 3. Mês/ano de referência da fatura informado pelo usuário

Hoje `ImportStatementModal.tsx` (linhas ~749–777) deriva `billRef` das próprias linhas do extrato. Quando a fatura tem parcelas ou compras de meses anteriores, o mês resolve errado (usuário sobe fatura de fevereiro, sistema busca janeiro).

### 3.1 Novo campo no passo "Conferir" (step `preview`)

- Em `src/components/lancamentos/ImportStatementModal.tsx`, adicionar `<Input type="month">` com o rótulo **"Qual o mês desta fatura?"** e hint curto: "Usamos para buscar os lançamentos já registrados neste mês."
- Estado local `billReferenceMonth: string` (`YYYY-MM`).
- Pré-preencher com o mês mais frequente entre `statement_due_date` / `resolved_competence_date` das linhas (sugestão, não fonte da verdade).
- Bloquear o botão "Avançar para conciliação" enquanto o campo estiver vazio, apenas para importações de cartão. Para extrato bancário, o campo é opcional e o fluxo atual continua.

### 3.2 Usar o valor na busca de lançamentos do sistema

No efeito que carrega `orphans` e `systemBill` (linhas ~735–853):

- Quando `billReferenceMonth` estiver definido, calcular `billStart` e `billEnd` a partir dele (primeiro e último dia do mês), ignorando `billDate` derivado das linhas.
- Manter `minDate`/`maxDate` (janela ±3 dias) apenas para o cruzamento por data de compra da Onda A.
- Incluir `billReferenceMonth` nas dependências do `useEffect`.

### 3.3 Persistência e deep-link

- Propagar `billReferenceMonth` para `importResult.dateFrom/dateTo` quando presente, para que o link em Análises EVA respeite o mês informado.

## Detalhes técnicos

Arquivos afetados:
- `src/components/lancamentos/import/ReconcileStep.tsx` — posicionamento dos rótulos.
- `src/components/lancamentos/ImportStatementModal.tsx` — novo estado `billReferenceMonth`, input no step `preview`, uso no cálculo do escopo da fatura.
- `supabase/functions/parse-bank-statement/index.ts` — reescalar `statement_total` /100 quando ~100× a soma das linhas.

Fora de escopo: `neu-toggle.tsx`, outras edge functions, sugestões de categoria, webhook do WhatsApp.
