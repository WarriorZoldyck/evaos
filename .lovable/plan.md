## Diagnóstico

O sanity check anterior só protege o `statement_total` (descarta se >20× a soma das linhas). Mas pelo que você descreve ("está passando para oitocentos mil" no total importado, não só no campo do banco), o problema agora é diferente: **a IA está lendo os valores das próprias linhas multiplicados por 100** — provavelmente pegando `8.850,02` como `885002`. Quando a soma das linhas também fica inflada, o sanity check de 20× não dispara, porque a razão `statement_total / soma` continua ≈ 1.

O prompt atual instrui "use ponto como decimal", mas o Gemini, ao ver `8.850,02`, às vezes interpreta o `.` como separador de milhar, remove o `.` e a `,`, e devolve `885002`. Sem casas decimais explícitas, vira inteiro em reais.

## Preciso da fatura

Manda o PDF (pode anonimizar nome/cartão) para eu confirmar **o formato exato** dos números na fatura antes de aplicar o fix. Saber se é `R$ 8.850,02`, `8.850,02`, ou outro padrão (ex.: alguns bancos usam `8 850,02`) muda a robustez da defesa.

## O que será feito (assim que confirmar com a fatura)

### 1. Endurecer o prompt do parser (`supabase/functions/parse-bank-statement/index.ts`)
- Instruir explicitamente: "Brazilian statements use `.` as thousand separator and `,` as decimal. `R$ 1.234,56` MUST become `1234.56`, NEVER `123456` nor `1234`. Always include the 2 decimal places."
- Adicionar 2-3 exemplos no prompt: `R$ 8.850,02 → 8850.02`, `R$ 49,90 → 49.90`, `R$ 1.234.567,89 → 1234567.89`.
- Reforçar nas instruções do `amount` (hoje só diz "always positive") que o número deve preservar centavos.

### 2. Pós-processamento defensivo do `amount`
No bloco `txArray.map(...)`, após parsear `t.amount`:
- Se o número vier **inteiro** (sem casas decimais) E for >100, marcar como suspeito.
- Se a maioria dos `amount` numa fatura forem inteiros >100 (heurística: >70% das linhas), assumir que a IA esqueceu os decimais e **dividir todos por 100** uniformemente. Logar `console.warn` com a heurística aplicada para auditoria.
- Esse fallback só age quando o padrão é consistente em toda a fatura (evita corromper linhas legítimas como `R$ 1.000,00`).

### 3. Sanity check cruzado com `statement_total`
Hoje descartamos o total se ele for >20× a soma. Adicionar a inversa: se o `statement_total` for confiável (ex.: bate com soma/100), e a soma das linhas for ~100× o total, dividir as linhas por 100 (mesma heurística do item 2, mas ancorada num valor confiável da própria fatura).

### 4. UI — sinalizar quando o fallback foi aplicado
No `ImportStatementModal.tsx`, se o backend devolver um flag `amount_rescaled: true` (novo campo de resposta), mostrar um aviso amarelo no topo da tabela de pré-importação: "Os valores foram ajustados automaticamente porque o leitor confundiu os separadores decimais. Confira antes de importar."

## Arquivos a alterar

- `supabase/functions/parse-bank-statement/index.ts` — prompt + heurística + flag de resposta.
- `src/components/lancamentos/ImportStatementModal.tsx` — aviso amarelo quando `amount_rescaled` vier `true`.

## Fora do escopo

- Não muda matching, criação de lançamentos, schema, RLS, nem o sanity check existente do `statement_total`.
- Nenhum dado já importado é alterado retroativamente.
