# Corrigir cálculo de Faturamento + modal de detalhamento

## Problema
No `useDashboardData.ts` (linhas 366-378), o `faturamento` aplica uma lógica especial para parcelados: só conta a parcela 1 e multiplica por `original_amount` ou `amount × installments_total`. Isso faz com que:
- Períodos que não contêm a parcela 1 mostrem R$ 0 mesmo havendo competência de receita.
- O `original_amount` (campo usado por terminais para valor bruto antes do MDR) seja confundido com o valor total da venda parcelada — inflando o número quando há terminais.
- O resultado diverge do DRE, que simplesmente soma `amount` por `competence_date`.

Além disso, ao clicar no card "Faturamento", o dashboard navega para `/lancamentos?type=receita` filtrando por `payment_date` — mas faturamento é por **competência**, então o usuário vê números diferentes e fica confuso.

## Mudanças

### 1. `src/hooks/useDashboardData.ts`
Substituir o bloco `faturamento` (linhas 367-378) por soma simples de todas as receitas no `competenceTransactions` do período:

```ts
const faturamento = competenceTransactions
  .filter((t) => t.type === "receita")
  .reduce((acc, t) => acc + Number(t.amount), 0);
```

Isso passa a bater 100% com a linha de receita do DRE (mesma base: `amount` por `competence_date`, excluindo transferências internas — já feito na query).

Aplicar a mesma simplificação ao cálculo de `prevFaturamento` (período anterior) em qualquer lugar que use a mesma lógica de installments — buscar e ajustar.

### 2. Novo componente `src/components/dashboard/FaturamentoDetailModal.tsx`
Modal acionado pelo clique no card "Faturamento" no lugar da navegação atual. Conteúdo:

- **Header**: "Faturamento por competência" + intervalo do período (`dateFrom` – `dateTo`).
- **Resumo no topo**: total do período, ticket médio, nº de lançamentos, comparativo % vs período anterior.
- **Lista**: receitas do período (vindas de `competenceTransactions`, type=`receita`), ordenadas por `competence_date` desc, com colunas: data de competência, descrição, contato, categoria, conta/cartão, valor. Paginada (50/página) ou virtualizada se >200 itens.
- **Agrupamentos opcionais (tabs)**: "Por mês de competência", "Por categoria", "Por contato" — cada um mostrando uma mini-tabela com subtotal.
- **Ações**: botão "Ver todos os lançamentos do período" que navega para `/lancamentos` filtrando explicitamente por competência (passar um parâmetro novo `dateField=competence_date` e ajustar `Lancamentos.tsx` para honrar isso quando presente; manter `payment_date` como default).

### 3. `src/components/dashboard/SummaryCards.tsx`
- Trocar o `onClick` do card "Faturamento" para abrir o modal acima em vez de chamar `go({ type: "receita" })`.
- Receber via prop um callback `onFaturamentoClick` (ou expor o array de receitas por competência) — provavelmente mais limpo passar `onFaturamentoClick` e deixar o `Dashboard.tsx` orquestrar o estado do modal.

### 4. `src/pages/Dashboard.tsx`
- Estado local `faturamentoModalOpen`.
- Passa o callback para `SummaryCards` e renderiza o `FaturamentoDetailModal` com os dados de `competenceTransactions` (precisa expor isso no retorno do `useDashboardData` se ainda não estiver exposto).

### 5. `src/pages/Lancamentos.tsx` (ajuste leve, opcional)
Suportar `?dateField=competence_date` para que o botão "Ver todos" do modal mostre exatamente o mesmo recorte. Se for inviável neste passo, abrir `/lancamentos` sem esse refinamento e deixar como melhoria futura.

## Verificação
- Abrir o dashboard em um período conhecido e conferir que `Faturamento` = soma da linha "Receita Operacional Bruta" do DRE no mesmo intervalo.
- Clicar no card → modal abre com a lista de receitas por competência, total = valor exibido no card.
- Trocar o período e o filtro de empresa/pessoal e validar que ambos (card + modal) atualizam consistentemente.

## Não está no escopo
- Lógica de DRE (já está correta segundo o usuário).
- Outras métricas do dashboard (Entradas/Saídas/Saldo continuam por `payment_date`, como hoje).
- Migrações de banco.