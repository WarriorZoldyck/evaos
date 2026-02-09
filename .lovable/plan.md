
## Maquininhas, Detalhes de Lancamento e Melhorias na Liquidacao

Este plano abrange 4 grandes blocos de funcionalidade interligados.

---

### Bloco 1 - Gestao de Maquininhas na Pagina de Contas

A tabela `card_terminals` ja existe no banco com dados reais (REDE, TESTE 2612, etc.). Tem campos para taxas de debito/credito, prazos D+N, e taxas por parcelamento em `rates_info` (JSON). O que falta e a interface no app.

**O que sera feito:**
- Adicionar uma 4a aba "Maquininhas" na pagina de Contas (`src/pages/Contas.tsx`)
- Listar maquininhas cadastradas com: Nome, Adquirente, Conta vinculada, badges de taxas (ex: DEBITO: 0.99% D+1, CREDITO: 3.29% D+2)
- Modal de cadastro/edicao de maquininha (`src/components/contas/TerminalFormModal.tsx`):
  - Campos: Nome, Adquirente, Conta de Recebimento (select das bank_accounts), Identificacao Serial
  - Secao "Prazos de Liquidacao e Taxas Base": D+ Debito, Taxa Debito (%), D+ Credito, Taxa Credito (%)
  - Secao "Taxas por Parcelamento": lista dinamica com campos VEZES + TAXA (%), botao "+ Novo Plano/Parcela", botao excluir por linha
  - Nota informativa: "A EVA aplicara essas taxas automaticamente ao selecionar esta maquininha no lancamento."
- CRUD completo no hook `useAccounts.ts` para `card_terminals`

---

### Bloco 2 - Maquininha no Formulario de Lancamento (Receita)

Quando o usuario cria uma receita e seleciona "Cartao de Credito" ou "Cartao de Debito" como forma de pagamento:

**Campos condicionais que aparecem:**
- Select de Maquininha (filtrado por contexto pessoal/empresa)
- Ao selecionar a maquininha, o sistema automaticamente:
  - Mostra a taxa aplicavel (debito base, credito base ou taxa do parcelamento correspondente)
  - Calcula e exibe: Valor bruto, Desconto MDR (taxa %), Valor liquido
  - Define a data de recebimento automaticamente: data do lancamento + D+N da maquininha
  - Associa a `bank_account_id` da maquininha como conta de recebimento

**Forma de pagamento contextual:**
- Quando forma de pagamento = "PIX": mostra apenas select de Conta Bancaria ou Carteira
- Quando forma de pagamento = "Dinheiro": mostra apenas select de Carteira
- Quando forma de pagamento = "Boleto": mostra apenas select de Conta Bancaria
- Quando forma de pagamento = "Cartao de Credito": mostra select de Maquininha + calculo de MDR
- Quando forma de pagamento = "Cartao de Debito": mostra select de Maquininha + calculo de MDR
- Quando forma de pagamento = "Transferencia": mostra select de Conta Bancaria

O campo `card_terminal_id` ja existe na tabela `transactions`.

---

### Bloco 3 - Detalhes do Lancamento (novo componente)

Ao clicar em um lancamento na lista, abre um painel/modal de detalhes com todas as informacoes:

**Informacoes exibidas:**
- Descricao, tipo (receita/despesa), status
- Datas: pagamento, competencia, recebimento (se maquininha)
- Categoria completa (hierarquia)
- Fornecedor ou Cliente vinculado
- Forma de pagamento + conta vinculada
- Se maquininha: Valor original, Taxa MDR (%), Valor da taxa, Valor liquido, Nome da maquininha, Prazo D+N
- Se parcelado: Numero da parcela, total de parcelas, valor original da serie
- Observacoes, codigo de barras, anexo
- Botoes de acao: Editar, Duplicar, Liquidar, Excluir

**Novo componente:** `src/components/lancamentos/TransactionDetailModal.tsx`

**Integracao:** No `TransactionTable`, o clique na linha abre os detalhes (nao edita diretamente). O menu de 3 pontos continua com as acoes rapidas.

---

### Bloco 4 - Melhorias na Liquidacao

**Liquidacao de series (parcelado/recorrente):**
- Quando clicar em "Liquidar" em um lancamento que faz parte de uma serie, perguntar: "Liquidar somente este" ou "Liquidar todos pendentes da serie"
- Se liquidar todos, atualiza o status de todos os lancamentos pendentes da mesma `series_id`

**Parcelamento de fatura do cartao:**
- Ao liquidar um lancamento de cartao de credito, adicionar opcao "Parcelar esta fatura"
- Campos adicionais: Quantidade de parcelas, Taxa de juros (%)
- O sistema calcula o novo valor total (com juros) e gera as parcelas como novos lancamentos vinculados

---

### Detalhes Tecnicos

**Arquivos a serem criados:**

| Arquivo | Descricao |
|---|---|
| `src/components/contas/TerminalFormModal.tsx` | Modal de cadastro/edicao de maquininha com taxas base e parcelamento |
| `src/components/lancamentos/TransactionDetailModal.tsx` | Modal de detalhes completo de um lancamento |

**Arquivos a serem modificados:**

| Arquivo | Mudanca |
|---|---|
| `src/hooks/useAccounts.ts` | Adicionar CRUD de `card_terminals` (fetch, create, update, delete) + exportar tipo `CardTerminal` |
| `src/pages/Contas.tsx` | Adicionar 4a aba "Maquininhas" com listagem e acoes |
| `src/hooks/useTransactions.ts` | Adicionar `cardTerminals` ao fetch auxiliar para uso no form e detalhes |
| `src/components/lancamentos/TransactionFormModal.tsx` | Adicionar select de maquininha condicional, calculo de MDR, data automatica D+N, campos condicionais por forma de pagamento |
| `src/components/lancamentos/TransactionTable.tsx` | Adicionar onClick na linha para abrir detalhes + prop `onViewDetails` |
| `src/pages/Lancamentos.tsx` | Integrar `TransactionDetailModal` e `cardTerminals`, passar maquininhas ao form |
| `src/components/dashboard/LiquidateModal.tsx` | Adicionar opcao de liquidar serie inteira e parcelar fatura do cartao |

**Estrutura dos dados de maquininha (ja existente no banco):**

```text
card_terminals:
  - name: "REDE"
  - acquirer: "REDE"  
  - bank_account_id: uuid (conta onde cai o dinheiro)
  - debit_rate: 0.99
  - credit_rate: 3.29
  - settlement_days_debit: 1 (D+1)
  - settlement_days_credit: 2 (D+2)
  - rates_info: JSON com taxas por parcela
    [{"installments": 2, "rate": 4.64}, {"installments": 3, "rate": 5.24}, ...]
```

**Calculo de MDR no lancamento:**

```text
Se forma_pagamento = "Cartao de Debito":
  taxa = maquininha.debit_rate
  dias_recebimento = maquininha.settlement_days_debit

Se forma_pagamento = "Cartao de Credito" e SEM parcelamento:
  taxa = maquininha.credit_rate
  dias_recebimento = maquininha.settlement_days_credit

Se forma_pagamento = "Cartao de Credito" e COM parcelamento:
  taxa = rates_info.find(r => r.installments === num_parcelas)?.rate || credit_rate
  dias_recebimento = maquininha.settlement_days_credit

Valor da taxa = valor_bruto * (taxa / 100)
Valor liquido = valor_bruto - valor_da_taxa
Data de recebimento = data_pagamento + dias_recebimento
```

**Nenhuma migracao de banco necessaria** - a tabela `card_terminals` ja existe com todos os campos necessarios, e `transactions` ja tem `card_terminal_id`.
