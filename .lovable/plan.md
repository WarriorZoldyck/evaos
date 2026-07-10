## Diagnóstico do erro da Sabrina + plano de correção (sem separar cartão/conta agora)

### O que a Sabrina relatou

Nos prints/vídeos enviados:

- **Saldo real da conta (extrato do banco):** R$ 4.569,48
- **Saldo mostrado no EVA OS:** R$ 5.232,00
- **Diferença:** ~R$ 662,52 (o sistema está **maior** que a realidade)
- Um segundo caso: "Saldo do dia Cc + ContaMax principal R$ 2.519,47" vs card "SALDO ATUAL R$ 2.098" (diferença ~R$ 421)

### Causa raiz mais provável (encontrada no código)

No `useDashboardData.ts`, a função `fetchBalances` calcula o "Saldo Atual" assim:

```ts
// linha ~231-240
let txQuery = supabase
  .from("transactions")
  .select("type, amount")
  .eq("status", "Pago")
  .or(`bank_account_id.in.(${bankIds}),wallet_id.in.(${walletIds})`);
const { data: txData } = await txQuery;
totalPaidDelta = txData.reduce(...);
```

**Não há `.limit()` nem `.range()` de paginação.** O Supabase aplica **limite silencioso de 1.000 linhas**. Se a Sabrina tem mais de 1.000 lançamentos pagos históricos naquelas contas (muito provável para uma clínica em operação há meses), a soma é **truncada** — o "Saldo Atual" fica errado para mais ou para menos dependendo de quais 1.000 entraram.

Sintoma bate: valor não confere com o extrato, diferença arbitrária (~R$ 662, ~R$ 421), fica pior conforme a base cresce, e aparece de forma inconsistente entre contas (cada conta tem volume diferente de histórico).

Outros dois pontos secundários já mapeados no mesmo arquivo:

- `AccountStatementModal.tsx` calcula `priorBalance` (saldo anterior do mês no extrato) também **sem paginação** (linhas ~180-215). Mesmo problema: extratos antigos truncam. Isso explica por que o "Saldo do dia" no extrato do sistema não bate com "SALDO ATUAL" do dashboard — os dois usam consultas diferentes, com truncamentos diferentes.
- A RPC `get_account_balance` (usada em `ConciliacaoBancaria`) usa `LEFT JOIN` no Postgres, **sem** o limite de 1.000 — ou seja, se a conciliação bate mas o dashboard não, isso reforça a hipótese.

### O que NÃO vou fazer agora

- **Não vou separar** o `ImportStatementModal` em cartão + conta. Reafirmo o plano anterior: o modal é altamente parametrizado (~30 pontos de ramificação) e acabou de estabilizar. Duplicar arquivos agora regride correções recentes e dobra a superfície de erro no meio da investigação. Adiamos para depois que o débito estiver estável.

### Correção proposta (cirúrgica, invisível para o usuário até funcionar melhor)

**Arquivo 1: `src/hooks/useDashboardData.ts` (função `fetchBalances`, ~linhas 200-255)**

Substituir a soma no cliente por uma **RPC nova** `get_accounts_balance_bulk(bank_ids uuid[], wallet_ids uuid[])` que faz a soma direto no Postgres (sem limite de 1.000). A RPC retorna `{ paid_delta: numeric }`. Reutiliza a lógica já validada de `get_account_balance`, só que aceita arrays.

Vantagens:
- Elimina o teto de 1.000 linhas de vez.
- Reduz payload de rede (não traz N linhas, só a soma).
- Mais rápido.

**Arquivo 2: `src/components/contas/AccountStatementModal.tsx` (~linhas 170-215)**

Trocar as duas queries de `priorBalance` (direct + bill) por uma RPC `get_account_prior_balance(account_id uuid, account_type text, date_from date)` que devolve o delta acumulado até `date_from`. Sem limite de 1.000.

**Migration nova:** cria as duas funções `SECURITY DEFINER` com `set search_path = public`, respeitando RLS por `auth.uid() = user_id` na cláusula `WHERE` interna.

### Verificação após o fix

1. Rodar SQL de auditoria comparando, para a Sabrina, o "Saldo Atual" atual (via `useDashboardData` antigo) vs. o `initial_balance + SUM` completo. Confirmar que a diferença bate com os R$ 662,52 relatados.
2. Após aplicar a RPC, o valor no dashboard deve bater com o extrato do banco.
3. Não altero nenhum comportamento de importação, criação ou conciliação — só a **leitura** do saldo. Zero risco para dados existentes.

### Passos

1. Escrever a migration com as duas RPCs + `GRANT EXECUTE` para `authenticated`.
2. Substituir as chamadas em `useDashboardData.ts` e `AccountStatementModal.tsx`.
3. Rodar uma query de auditoria (via `supabase--read_query`) na base da Sabrina para confirmar diferença antes e depois.
4. Pedir para ela reabrir o dashboard e conferir se o Saldo Atual = extrato do banco.

### Pergunta rápida antes de implementar

Consigo o **e-mail (ou user_id)** da Sabrina para eu rodar a query de auditoria na base dela e confirmar que é exatamente o problema do teto de 1.000 antes de aplicar a migration? Assim eu meço o antes/depois e te dou a prova concreta.
