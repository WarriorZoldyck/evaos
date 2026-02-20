
## Tabela de Preview de Parcelas no Formulario

### Resumo
Adicionar uma tabela visual de preview das parcelas que aparece **abaixo** dos campos de parcelamento ja existentes (numero de parcelas, intervalo, juros). Nada do que existe hoje sera removido ou alterado -- a tabela e um complemento que mostra cada parcela com data e valor, permitindo editar o valor da 1a parcela e escolher se distribui a diferenca entre as demais.

### O que muda na pratica

Quando o parcelamento estiver ativo e o valor + quantidade de parcelas forem validos, uma tabela aparece mostrando:

| N | Vencimento | Valor (R$) |
|---|------------|------------|
| 1 | 20/02/2026 | *editavel* |
| 2 | 20/03/2026 | 250,00 |
| 3 | 20/04/2026 | 250,00 |
| **Total** | | **750,00** |

- O valor da 1a parcela pode ser editado diretamente na tabela (campo inline)
- Ao alterar, aparece uma opcao "Distribuir diferenca nas demais parcelas" (marcada por padrao)
  - Se marcada: o saldo restante e dividido igualmente entre as parcelas 2..N
  - Se desmarcada: as demais parcelas mantem o valor original (divisao simples do total)
- Quando tem juros (taxa > 0), os valores sao fixos (Price) e nao permite edicao da 1a parcela
- A tabela substitui o bloco atual de preview simples ("Nx de R$ X") e o toggle "Valor da 1a parcela diferente?" -- mesma funcionalidade, mas agora visual e integrada

### Detalhes tecnicos

**Novo componente:** `src/components/lancamentos/InstallmentPreviewTable.tsx`

Recebe como props:
- `totalAmount`, `installmentsCount`, `paymentDate`
- `intervalType` ("monthly" | "custom_days"), `customDays`
- `interestRate`
- `firstInstallmentAmount`, `onFirstInstallmentChange`

Logica interna:
- Calcula datas com `addMonths` ou `addDays` conforme intervalo
- Se juros > 0: mostra parcelas Price (somente leitura)
- Se juros = 0: permite editar a 1a parcela; checkbox "Distribuir diferenca" controla se as demais recebem o saldo restante ou mantem valor padrao

**Alteracao em `TransactionFormModal.tsx`:**
- Substituir o bloco de preview (linhas ~1533-1571) pelo novo `InstallmentPreviewTable`
- Remover o state `customFirstInstallment` (o toggle antigo) -- a funcionalidade agora esta dentro da tabela
- O campo `first_installment_amount` do form continua sendo usado, mas controlado pela tabela via callback
- Nenhuma alteracao na logica de submit (ja suporta `first_installment_amount`)

**Componentes usados:** `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` (ja existentes), `Input`, `Checkbox`, `Label`

### Arquivos

| Arquivo | Acao |
|---------|------|
| `src/components/lancamentos/InstallmentPreviewTable.tsx` | Criar (novo componente) |
| `src/components/lancamentos/TransactionFormModal.tsx` | Alterar (substituir preview simples + toggle pela tabela) |
