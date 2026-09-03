# Corrigir fatura do cartão ITAÚ JOÃO (PJ → PF) e criar ação em massa de contexto

## Diagnóstico confirmado no banco

- Cartão **ITAÚ JOÃO** (`2249d5cb…`) já está cadastrado como **Pessoal** (sem empresa), fechamento dia 3, vencimento dia 10.
- Mesmo assim, **56 lançamentos** desse cartão estão marcados como **PJ (Sabrina Rodrigues Domingues)** — é exatamente o grupo "Cartão • Fatura set/2026", R$ 2.695,62, do vídeo.
- Todos com data de pagamento **01/09/2026** e status **Pago**.
- Competência: 34 itens de **julho** (R$ 1.705,27) e 22 itens de **agosto** (R$ 990,35).

## Parte 1 — Correção dos dados (só os 56 do vídeo)

1. **Contexto**: mover os 56 lançamentos para Pessoal (remover o vínculo com a empresa).
2. **Datas de vencimento**, pela regra do cartão (fecha 3 / vence 10):
   - compras de **julho/2026** → pagamento em **10/08/2026** (34 itens, R$ 1.705,27)
   - compras de **agosto/2026** até dia 2 → **10/08/2026**; de dia 3 em diante → **10/09/2026** (22 itens, R$ 990,35)
3. **Status**: permanece **Pago**, sem alteração.
4. A competência (data da compra) de cada item não muda.
5. Conferência depois da correção: nenhum lançamento desse cartão continua em PJ, e os totais por fatura passam a ser agosto/2026 e setembro/2026 conforme acima.

Nada é excluído — apenas contexto e data de pagamento são ajustados.

## Parte 2 — Ação em massa "Mover para contexto"

Na página **Lançamentos**, ao selecionar linhas, a barra de seleção hoje tem "Conciliar" e "Excluir". Será adicionado **"Mover para…"**:

- abre um diálogo com a lista de contextos disponíveis (Pessoal + empresas do usuário);
- ao confirmar, atualiza o contexto de todos os selecionados de uma vez;
- validação: se algum lançamento estiver ligado a conta/cartão/maquininha que pertence a outro contexto, o diálogo avisa e lista os itens antes de confirmar, para não gerar vínculo inconsistente;
- toast de confirmação e recarregamento da lista.

## Detalhes técnicos

- Correção de dados: `UPDATE` em `transactions` (`company_id = NULL`, `payment_date` recalculado por faixa de competência) filtrando pelos 56 ids do cartão `2249d5cb…` com `payment_date = 2026-09-01`.
- UI: `src/components/lancamentos/TransactionTable.tsx` (novo botão na barra de seleção) + novo `MoveContextDialog.tsx`; handler em `src/pages/Lancamentos.tsx` chamando uma nova função `updateMultipleTransactionsContext` em `src/hooks/useTransactions.ts`.
- Contextos vêm de `useCompany()`; a checagem de coerência usa `company_id` de `bank_accounts`, `credit_cards`, `wallets` e `card_terminals` já carregados pelo hook.
