# Corrigir o campo "Total informado pelo banco" no Importador

## Diagnóstico

Na tela enviada, o usuário digitou `885002,00` no campo "Total informado pelo banco". O parser lê esse valor como **R$ 885.002,00**, comparando contra o total real importado (**R$ 8.825,02**) e gerando a "divergência" gigante de **R$ 876.176,98**. O bug é de UX/entrada de dado, não de cálculo:

1. O parser do PDF (`parse-bank-statement`) **já extrai** o `statement_total` da fatura e o backend já devolve esse valor — o `ImportStatementModal` armazena em `statementTotal` (linha 199/412–415), mas **nunca preenche o input** `statementTotalInput`. O usuário precisa redigitar à mão, e erra a formatação.
2. O input aceita texto livre sem máscara. Quem digita `885002,00` esperando "oito mil oitocentos e cinquenta e dois reais" não recebe nenhum feedback visual.
3. Mesmo quando o parser falha em pegar o total, o campo fica em branco — sem placeholder claro do formato esperado.

## O que será feito

### 1. Auto-preencher o input a partir do total detectado pelo parser
- Em `src/components/lancamentos/ImportStatementModal.tsx`, quando `parsedStatementTotal` for definido (linha ~412), também setar `statementTotalInput` com o valor formatado em pt-BR (ex.: `8.850,02`).
- Quando o usuário trocar de arquivo / resetar (linha ~799), limpar `statementTotalInput` também.
- Mostrar uma badge discreta `(detectado da fatura)` ao lado do label quando o valor veio do parser, para o usuário saber que pode confiar ou editar.

### 2. Máscara/normalização no input
- Trocar o `<input>` por um campo controlado que:
  - Aceita apenas dígitos, vírgula e ponto;
  - Em `onBlur`, normaliza para o formato pt-BR (`1.234,56`) usando `toLocaleString("pt-BR", { minimumFractionDigits: 2 })`;
  - Mantém parsing atual (remove `.`, troca `,` por `.`) — já correto.
- Placeholder mais claro: `Ex.: 8.850,02`.
- Pequena dica visual quando o número parecer fora de escala (>10× o total importado): tooltip "Verifique o separador decimal" — sem bloquear, só alertar.

### 3. Reforçar extração do total no parser
- No prompt do edge function `parse-bank-statement/index.ts`, deixar explícito que o `statement_total` deve ser o "Total da fatura atual" / "Valor total a pagar", em reais, **número decimal com ponto** (ex.: `8850.02`), nunca com separadores de milhar.
- Adicionar sanity check no servidor: se `statement_total` for >100× a soma de `amount` dos itens, descartar (provavelmente leitura errada de número).

## Arquivos alterados

- `src/components/lancamentos/ImportStatementModal.tsx` — auto-fill, máscara, badge "detectado".
- `supabase/functions/parse-bank-statement/index.ts` — clareza no prompt + sanity check do total.

## Fora do escopo

- Não mexe na lógica de matching, de criação de lançamentos, nem no schema/RLS.
- Não altera o comportamento da checkbox "Entendi a divergência" — apenas reduz a chance de cair nela por erro de digitação.
