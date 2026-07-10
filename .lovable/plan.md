## Alinhar cabeçalho da fatura do cartão com os lançamentos normais

Arquivo: `src/components/lancamentos/TransactionTable.tsx` — componente `CardBillGroupRow` (linhas ~421-560).

Hoje as badges (`59 lançamentos`, `Paga`, `Conciliada`, `38/55 conciliados`, `Mês conciliado`) ficam **coladas no nome do cartão**, à esquerda. O valor fica solto no meio, e o botão "Pagar Fatura" empurra o menu. Os lançamentos normais seguem outra ordem: **título · valor · pill Conciliado · badge Pago · menu**.

### Mudanças

1. **Remover** as badges de dentro do bloco do título (deixar só `<CreditCard />` + nome do cartão + eventual truncate).
2. **Reordenar** os elementos à direita, na mesma sequência dos lançamentos normais:
   - Valor (mesma largura/alinhamento — `text-right shrink-0`, mesmo `text-sm font-semibold`).
   - Pill de conciliação (`Conciliada` / `X/Y conciliados` / vazio), no mesmo estilo `rounded-full border px-2 py-0.5 text-[10px]` das linhas de transação — cor conforme estado (emerald/amber).
   - Badge de status (`Paga` / `Pendente` — hoje só temos `Paga`; adicionar variante secundária discreta quando a fatura ainda tem pendências, para bater com o padrão).
   - Badge `Mês conciliado` (quando fechado) — manter, logo após o status.
   - Contador `Nx lançamentos` — mover para **antes do valor** como texto sutil (`text-[10px] text-muted-foreground`), sem visual de badge, pra não competir com as pills à direita.
   - Botão `Pagar Fatura` (quando aplicável) e menu `⋯` no final, como já estão.
3. Garantir `gap-2` consistente entre as pills/badges à direita e mesmo `shrink-0` para não quebrar layout no responsivo.
4. Manter o comportamento de clique (row toggle) e os `stopPropagation` das ações.

Sem mudança de lógica — só reestruturação visual do JSX para espelhar o padrão dos lançamentos.
