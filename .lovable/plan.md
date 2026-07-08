## Diagnóstico

No import do Azul o painel mostrou **0 no sistema × 18 no extrato**. Isso não é apenas problema de similaridade textual — é que o candidato nunca chega no matcher.

Motivos, na ordem:

1. **Query super restrita** (`useImportMatching.ts`). Para cartão, filtramos `credit_card_id = <cartão>`. Se o usuário lançou as compras do Azul manualmente sem vincular ao cartão (ex.: como despesa comum na conta corrente ou "outros"), elas ficam com `credit_card_id = null` e **nunca entram na lista de candidatos**. Como esse usuário raramente lança pré-vinculado, o resultado é sempre 0.
2. **Janela de data de 5 dias no cartão** (`CARD_DATE_WINDOW_DAYS = 5`) — em fatura mensal (competência do mês inteiro) é curto demais quando a pessoa lançou a compra em outra data.
3. **Auto-link exige similaridade ≥ 0.34** (ou trio perfeito: mesmo dia + valor exato + contato reconhecido). Nomes de extrato de cartão são quase sempre truncados/diferentes ("MERCADOP\*XYZ") do que o usuário digita ("Mercado do Bairro"), então similaridade fica em 0 e o trio nunca fecha.
4. **`ReconcileStep` só mostra alternativas do que o matcher devolveu.** Se não achou nada, não tem o que sugerir manualmente.

## O que fazer

Deixar o sistema **cruzar por valor + data primeiro**, e usar descrição só como desempate/confiança. Basicamente o que planilhas de conciliação (Mint/YNAB/Conta Azul) fazem.

### 1. Ampliar a busca de candidatos (cartão) — `useImportMatching.ts`

Ao importar cartão, buscar em **duas ondas** e mesclar:

- **Onda A (atual):** `credit_card_id = <cartão>` no período da competência.
- **Onda B (nova):** `credit_card_id IS NULL` **AND** (`bank_account_id` do dono ou qualquer da company) no período da competência, **filtrando em memória apenas os que batem valor** com alguma linha do extrato (±0.05). Isso captura compras lançadas "soltas" que o usuário quer reconciliar com a fatura.

Reaproveita o filtro `AMOUNT_TOLERANCE` que já existe.

### 2. Alargar a janela de datas do cartão

`CARD_DATE_WINDOW_DAYS: 5 → 15`. Ainda fica dentro de um ciclo (30d), mas cobre lançamentos digitados dias antes/depois da compra real.

### 3. Novo tier de sugestão: "provável por valor+data"

Em `matching.ts`, adicionar constante `AMOUNT_DATE_ONLY_SIM = 0` e nova regra em `pickBestMatch`:

- Se **não há trio forte** e a similaridade é baixa, mas o candidato tem **valor exato** e é o **único** com esse valor na janela → devolve como match "sugerido" (não auto-linkado), com um novo campo `suggested: true`.
- Quando `suggested = true`, `ReconcileStep` deixa a linha em modo **"revisar"** (não marca `link` automaticamente) mas já pré-preenche o candidato e mostra o botão **"É o mesmo"** para o usuário confirmar num clique, do lado do card do candidato.

Isso resolve o caso Azul: o valor bate, a data está próxima, mas o nome não bate → sistema oferece o candidato certo em vez de dizer "0 no sistema".

### 4. Fallback textual — só tokens curtos

Nos merchants de cartão o token útil costuma ter 3–4 letras ("UBER", "IFOO", "AMZ"). Baixar o mínimo de token de 4 → 3 caracteres **só** dentro de `descriptionSimilarity` (não em `sharesToken`, para não gerar falso-positivo grosseiro). Ajuda a pontuar "UBER *TRIP" contra "Uber viagem centro".

### 5. UI — `ReconcileStep`

- Nas linhas que tiverem `best.suggested = true`, mostrar badge **"Provável — confirmar"** ao invés de "Conciliado" e deixar o padrão como **criar novo** até o usuário clicar em "É o mesmo".
- No painel do topo, contar essas como "🟡 X prováveis a revisar" ao lado dos "✅ conciliados" e "⚠️ só no extrato".

## Escopo

Só o pipeline de matching e a apresentação da conciliação. Nada muda no parser, no import propriamente dito, nem na criação de lançamento. Testes em `matching.test.ts` ganham 2 casos: (a) valor exato + data próxima + nome totalmente diferente → devolve `suggested`; (b) dois candidatos com mesmo valor no período → NÃO sugere (ambíguo).

## Fora do escopo

- Não vamos mudar `credit_card_id` de transações antigas nem fazer merge automático de contas — só sugerir.
- Não vamos alterar o edge function `parse-bank-statement`.

Aguardando OK para implementar.