## Problemas identificados na importação de espclin@hotmail.com

**1. Status incorreto (Realizado em vez de Projetado)**
No fluxo de importação por cartão de crédito (`ImportStatementModal.tsx`, linha 576), todas as transações criadas estão sendo gravadas com `status: "Pago"`. Para compras de cartão de crédito, o correto é `status: "Pendente"` (Projetado) — elas só viram "Pago" quando a fatura for paga via fluxo "Pagar Fatura". Inclusive o formulário manual de novo lançamento por cartão já default para "Pendente" (linha 355 do `TransactionFormModal.tsx`).

**2. Etapa Conciliar/Categorizar pulada no cartão**
Hoje o wizard só mostra `1. Conferir → 2. Importar` para cartão (a etapa "Conciliar" é pulada quando `importType === "cartao"`). Resultado: o usuário não vê a coluna de **Categoria sugerida** (histórico/IA) nem pode revisar categorias antes de criar. Isso anula o benefício da categorização automática que foi implementada.

---

## Mudanças propostas

### A) Status correto para cartão de crédito
Em `ImportStatementModal.tsx`, ao montar as transações novas:
- Se `importType === "cartao"` → `status: "Pendente"` (Projetado).
- Caso contrário (débito/conta) → manter `status: "Pago"` como hoje.

Efeitos colaterais a ajustar:
- O filtro pós-import ("Ver novos para categorizar") hoje força `status=Pago`. Quando a importação for de cartão, redirecionar com `status=Pendente` (ou `status=todos`) para o usuário encontrar os lançamentos recém-criados.
- Mensagem de sucesso/resumo: trocar "lançamentos realizados" por "lançamentos projetados" quando for cartão.

### B) Habilitar etapa "Conciliar" também para cartão (modo categorização)
Reaproveitar o passo 2 do wizard para cartão, mas em modo simplificado:
- **Sem busca de pendentes para conciliar** (compras de cartão não têm contrapartida pendente em conta corrente). Não exibir a seção "Correspondências encontradas".
- **Exibir apenas a seção "Criar no sistema"** com a tabela já existente do `ReconcileStep`, incluindo:
  - Coluna **Categoria sugerida** (badge "📚 histórico" ou "✨ IA").
  - Dropdown editável para o usuário ajustar antes de importar.
- Footer: "Voltar | Importar N transações como Projetadas".

Para isso:
- Remover o early-skip que pula direto de `preview → summary` no cartão.
- Passar uma flag `mode: "card" | "debit"` para `ReconcileStep` que oculta o bloco de matches e o título "Conciliar", mostrando algo como "Revisar categorias antes de importar".
- Disparar `useCategorySuggestions` no momento da transição `preview → reconcile` para cartão também (hoje já roda, mas a UI nunca é mostrada).

### C) Texto do stepper
Renomear chips quando for cartão: `1. Conferir → 2. Categorizar → 3. Importar` (em vez de "Conciliar"), deixando claro o que acontece nessa etapa para faturas.

---

## Arquivos afetados
- `src/components/lancamentos/ImportStatementModal.tsx` — status condicional, não pular reconcile para cartão, ajustar filtro pós-import e textos.
- `src/components/lancamentos/import/ReconcileStep.tsx` — aceitar prop `mode` para esconder seção de conciliação no modo cartão e ajustar título/labels.

## Fora de escopo
- Mudar lógica de fatura / pagamento de fatura.
- Reprocessar a importação já feita pelo espclin@hotmail.com (se quiser, posso rodar um script de service-role separado para virar os 59 lançamentos importados de "Pago" para "Pendente").
