# Ajustes em Editar e Liquidar lançamentos

## 1. Editar parcela mostra o valor total (Anexo 1)
Hoje, ao clicar em Editar numa parcela (ex.: 6 de 11, R$ 960), o campo Valor vem com o total da série (R$ 12.600).
- O campo Valor passa a abrir com o valor **da parcela** (R$ 960).
- O total da série continua visível como informação ("Valor original da série: R$ 12.600").
- Se a pessoa alterar, ela escolhe: aplicar só nesta parcela ou nas pendentes da série (opção que já existe).

## 2. Liquidar com forma de pagamento e divisão (Anexo 2)
Na tela Liquidar, adicionar:
- Campo **Forma de pagamento** (Dinheiro, Pix, Cartão débito/crédito, Boleto, Transferência…), começando com a forma original do lançamento.
- Botão **"Dividir pagamento"**: permite várias linhas (forma + valor + conta/carteira/maquininha), ex.: R$ 500 em dinheiro + R$ 460 no cartão.
- A soma das linhas precisa bater com o Valor Final; se não bater, aparece o aviso e o botão Confirmar fica travado.
- Ao confirmar, o lançamento original fica pago com a primeira parte e as outras partes viram lançamentos pagos ligados a ele (mesma categoria, cliente e competência), aparecendo no Histórico.

## 3. Dinheiro sem opção de conta (Anexo 3)
O campo Conta hoje lista só contas bancárias. Passará a listar também **Carteiras (dinheiro)** do mesmo contexto, separadas por grupo ("Contas bancárias" / "Carteiras"). Ao escolher Dinheiro como forma, as carteiras aparecem primeiro. Se não houver carteira, mostra atalho "Criar carteira".

## Detalhes técnicos
- `TransactionFormModal.tsx` linha ~451: usar `editTransaction.amount` quando `installments_total > 1`; manter `original_amount` só como exibição.
- `LiquidateModal.tsx`: buscar `wallets` além de `bank_accounts`; valor do select codificado `bank:<id>` / `wallet:<id>`; gravar `wallet_id` ou `bank_account_id` (zerando o outro) e `payment_method`.
- Divisão: primeira parte atualiza a transação; demais partes inseridas com `parent_id` = original, `status = Pago`. Respeita trigger `validate_transaction_required` (exige forma de pagamento/conta) e travas de fatura fechada.
- Sem mudança de banco.
- Testes: regra de soma das partes = valor final; edição de parcela carrega valor da parcela.
