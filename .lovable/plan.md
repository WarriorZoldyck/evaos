# Plano: modais para "Entradas previstas" e "Saídas previstas"

Reaproveitar o `EntradasSaidasDetailModal` para exibir também previstas (Pendentes), removendo o `navigate` para `/lancamentos` desses dois cards.

## 1) `EntradasSaidasDetailModal` — suportar Pendentes
- Novo prop opcional `statusFilter: "Pago" | "Pendente"` (default `"Pago"` para não quebrar chamadas existentes).
- Trocar filtro interno de `t.status === "Pago"` por `t.status === statusFilter`.
- Título/descrição dinâmicos:
  - `Pago` → "Entradas/Saídas pagas no período" (comportamento atual).
  - `Pendente` → "Entradas/Saídas previstas no período" + descrição "…com previsão de pagamento entre X e Y".
- Fonte dos dados: continuar usando `transactions` (dashboard já traz pagos e pendentes do período; verificar rapidamente na implementação — se não, usar `allTransactions` filtrado por payment_date do período).
- CSV: nome do arquivo passa a incluir `previstas` quando `statusFilter === "Pendente"`.
- Botão "Ver todos os lançamentos do período" mantém o `status` correto na query string.

## 2) `SummaryCards.tsx`
- Adicionar props opcionais: `onEntradasPrevistasClick?: () => void` e `onSaidasPrevistasClick?: () => void`.
- Nos `ForecastCard`s trocar `onClick={() => go(...)}` por `onClick={onEntradasPrevistasClick ?? (() => go(...))}` (e equivalente para saídas). O card "Saldo previsto" permanece como está.

## 3) `Dashboard.tsx`
- Novos estados: `entradasPrevModalOpen`, `saidasPrevModalOpen`.
- Passar handlers `onEntradasPrevistasClick` e `onSaidasPrevistasClick` para `SummaryCards`.
- Renderizar duas novas instâncias do `EntradasSaidasDetailModal` com `statusFilter="Pendente"`, `total={entradaPrevista}`/`{saidaPrevista}` (obter de `useDashboardData`), e `prevTotal` equivalente se disponível — caso contrário, omitir.
- Reutilizar `bankAccounts`, `wallets`, `creditCards`, `categoryNameResolver` e o mesmo `dateRange`.

## Fora de escopo
- Card "Saldo previsto" — continua indo para `/lancamentos`.
- Novo cálculo/agregação de previstas: usar valores já existentes em `useDashboardData`.
