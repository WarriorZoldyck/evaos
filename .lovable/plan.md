# Lançamento parcelado com várias formas de pagamento

## Problema
No "Novo Lançamento", quando o usuário liga **Parcelado** e define as formas de pagamento por parcela (ex.: boleto e dinheiro) na tabela de parcelas, o formulário ainda exige o campo geral **Forma de Pagamento** lá em cima e bloqueia o salvamento com "Informe a forma de pagamento e a conta".

## O que muda
- Se o lançamento for parcelado **e** as formas/contas estiverem definidas nas parcelas, o campo geral deixa de ser obrigatório.
- O campo geral mostra o texto "Definido por parcela" nesse caso, para o usuário entender.
- Cada parcela continua obrigada a ter forma de pagamento e conta (boleto → conta bancária, dinheiro → carteira etc.) e a soma das partes precisa bater com o valor da parcela. Se faltar algo, o aviso aponta a parcela específica.
- Lançamentos não parcelados continuam com a mesma exigência de hoje.

## Detalhes técnicos
- `TransactionFormModal.tsx`: adicionar campo oculto `per_installment_methods` (boolean) ao schema, sincronizado com `is_installment && flexiblePaymentEnabled && customInstallmentPayments` preenchido; no `superRefine`, pular as regras de `payment_method`/conta quando verdadeiro.
- No submit, validar cada parte: método + conta compatível (reaproveitar as mesmas regras do refine numa função `validatePartAccount`), toast "Parcela N: selecione a carteira/conta".
- Trigger do banco `validate_transaction_required` já recebe `payment_method` por parcela, então não precisa mudar.
- Teste: parcelado com partes boleto+dinheiro passa sem forma geral; parte de boleto sem conta é rejeitada.
