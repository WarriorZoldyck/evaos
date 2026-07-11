# Plano: Extrato ao clicar no Saldo Atual + Filtro de calendário

## 1) SaldoAtualDetailModal — abrir Extrato ao invés de navegar
- Remover a navegação para `/lancamentos`.
- Ao clicar em uma linha (conta ou carteira), abrir o `AccountStatementModal` já existente, passando:
  - `accountId`, `accountType` (`bank` | `wallet`), `accountName`, `initialBalance`
  - Novo prop `initialMonth` = data selecionada no Dashboard (período atual).
- Estado local no modal: `statementTarget` com os dados da conta clicada.
- Fechar o Saldo Atual ao abrir o Extrato (evita empilhar dois Dialogs Radix).

## 2) Dashboard — repassar a data selecionada
- Passar `selectedDate` (ou `dateFrom` do filtro do Dashboard) para `SaldoAtualDetailModal` via novo prop `initialMonth`.
- O modal repassa para o `AccountStatementModal`.

## 3) AccountStatementModal — filtro de calendário
- Manter as setas ‹ › atuais.
- Adicionar entre elas um botão com o nome do mês que abre um `Popover` com o componente `Calendar` (shadcn, já usado no projeto).
- Modo de seleção mensal: ao escolher qualquer dia, `setRefMonth(startOfMonth(day))`.
- Locale `ptBR`, `captionLayout="dropdown"` para permitir troca rápida de mês/ano.
- Aceitar novo prop opcional `initialMonth?: Date` para o estado inicial de `refMonth` (default: hoje).

## 4) Detalhes técnicos
- Arquivos alterados:
  - `src/components/dashboard/SaldoAtualDetailModal.tsx` — remover `useNavigate`, adicionar estado `statementTarget`, renderizar `<AccountStatementModal>` aninhado; novo prop `initialMonth`.
  - `src/pages/Dashboard.tsx` — passar `initialMonth={selectedDateFromPeriodFilter}` para `SaldoAtualDetailModal`.
  - `src/components/contas/AccountStatementModal.tsx` — novo prop `initialMonth`; substituir label do mês por `Popover`+`Calendar` mantendo as setas.
- Sem mudanças em hooks de dados, RLS ou schema.
- Sem alterações no `Lancamentos.tsx` (o parâmetro `accountId` de query string introduzido antes fica inerte; pode ser removido em passo futuro se desejado — fora do escopo).

## Fora de escopo
- Filtro por intervalo de datas customizado dentro do extrato (mantemos navegação mensal).
- Alterações de cálculo de saldo.
