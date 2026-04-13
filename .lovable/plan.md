

## Plano: Corrigir edição inline que salva valor parcial (ex: 1 em vez de 1500)

### Causa raiz

O `LiveNumberInput` dispara `onCommit` a cada tecla digitada via `onChange`. O `onInlineUpdate` chama `updateProcedure`, que:
1. Faz update no DB + delete/re-insert de itens
2. Tem o guard de concorrência (`updatingProcRef`) que **bloqueia** chamadas subsequentes

Resultado: usuário digita "1500" → a primeira tecla "1" dispara o update → as teclas "5", "0", "0" são bloqueadas pelo guard → o DB salva "1" → `fetchProcedures()` recarrega "1" do banco → breakdown mostra R$ 1,00.

### Solução

**1. Separar atualização local da persistência no banco**

- Criar uma função `inlineUpdateProcedure` no hook `usePricingV2.ts` que:
  - Atualiza o state local `procedures` imediatamente (sem DB)
  - Agenda um debounce de ~800ms para persistir no banco
  - Usa update simples no DB (só `desired_price` e/ou `execution_time`), sem delete/re-insert de itens

**2. Simplificar `LiveNumberInput` em `ProcedureTableV2.tsx`**

- Manter `onCommit` apenas no `onBlur` (quando sai do campo)
- Durante digitação (`onChange`), só atualizar o state local do componente
- Isso evita chamadas ao DB enquanto o usuário ainda está digitando

**3. Fluxo corrigido**

```text
Usuário digita "1500" no campo Preço
  ↓
onChange: atualiza só o valor visual local do input
  ↓
onBlur (sai do campo): chama onCommit(1500)
  ↓
inlineUpdateProcedure: atualiza state local + salva no DB
  ↓
Breakdown recalcula instantaneamente com o valor correto
```

### Arquivos afetados
- `src/hooks/usePricingV2.ts` — nova função `inlineUpdateProcedure` (update local + DB simples sem delete/re-insert de items)
- `src/components/precificacao-v2/ProcedureTableV2.tsx` — `LiveNumberInput` dispara `onCommit` só no `onBlur`
- `src/pages/Precificacao.tsx` — usar `inlineUpdateProcedure` no `onInlineUpdate`
- `src/pages/PrecificacaoV2.tsx` — idem

