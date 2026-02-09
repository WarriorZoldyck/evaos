

## Melhorias no Modulo de Lancamentos e Categorias

Este plano abrange 5 grandes melhorias solicitadas para os modulos de Lancamentos e Categorias.

---

### 1. Filtragem de Categorias por Tipo (Receita/Despesa) no Formulario

**Problema atual:** O formulario de novo lancamento mostra todas as categorias raiz, independentemente do tipo (receita/despesa) selecionado na aba.

**Solucao:**
- Filtrar `rootCategories` no `TransactionFormModal.tsx` pelo campo `type` da categoria
- Quando a aba for "receita", mostrar apenas categorias com `type = 'receita'` ou `type = 'ambos'`
- Quando a aba for "despesa", mostrar apenas categorias com `type = 'despesa'` ou `type = 'ambos'`
- Mesma logica para subcategorias e sub-subcategorias (herdam contexto do pai)
- As categorias ja possuem o campo `type` no banco de dados

### 2. Transferencia entre Contas Melhorada

**Problema atual:** A transferencia ja existe no formulario com aba separada criando 2 transacoes (saida e entrada) vinculadas por `transfer_id`. Porem, a conta de origem/destino so lista `bankAccounts`.

**Solucao:**
- Incluir tambem `wallets` e `credit_cards` como opcoes nos selects de origem e destino da transferencia
- Agrupar as opcoes por tipo (Contas Bancarias, Carteiras, Cartoes) usando separadores visuais no Select
- A logica de criar 2 lancamentos vinculados ja esta correta e nao precisa mudar

### 3. Parcelamento Avancado (Valor da Primeira Parcela + Edicao Individual + Deteccao de Juros)

**Problema atual:** O parcelamento divide o valor total igualmente entre todas as parcelas. Nao permite definir valor da 1a parcela diferente, nem detecta juros ao editar parcelas individuais.

**Solucao:**

**3a. Criacao de parcelas com valor customizado da 1a parcela:**
- Adicionar toggle "Valor da primeira parcela diferente?" quando parcelamento estiver ativo
- Campos: numero de parcelas, valor total, valor da 1a parcela (opcional)
- Se valor da 1a parcela for informado, o restante e distribuido igualmente entre as demais
- Formula: `valor_demais = (total - valor_1a) / (n_parcelas - 1)`

**3b. Edicao individual com recalculo:**
- Ao editar uma parcela de uma serie, permitir alterar o `amount`
- O sistema recalcula o `original_amount` (soma de todas as parcelas da serie)
- Se a soma ficar maior que o `original_amount` original, exibir um alerta: "O valor total ficou R$ X,XX acima do original. Deseja registrar como juros/ajuste?"
- Opcoes: "Registrar como juros" (cria campo `notes` automatico), "E apenas um ajuste" (atualiza silenciosamente)
- Ao salvar, atualiza o `original_amount` em todas as parcelas da serie

**3c. Toggle de recorrencia (Lancamento Fixo):**
- Adicionar segundo toggle no formulario: "Lancamento Fixo / Recorrencia" (conforme screenshot de referencia)
- Campos adicionais: frequencia (Mensal, Semanal, Quinzenal, Anual), data de fim (opcional)
- Gera transacoes futuras usando `series_id` com `installment_number` sequencial
- Diferenca do parcelado: o valor e o mesmo em todos, nao divide o total

### 4. Layout da Pagina de Lancamentos (Inspirado na Referencia)

**Problema atual:** A listagem atual usa uma tabela HTML padrao. O layout de referencia agrupa transacoes por conta, com icone, saldo acumulado, e cada transacao mostrando a hierarquia completa da categoria (ex: "MORADIA > FINANCIAMENTO").

**Solucao:**

**4a. Agrupamento por conta:**
- Agrupar transacoes por `bank_account_id` / `wallet_id` / `credit_card_id`
- Cada grupo mostra: icone da conta, nome, quantidade de movimentacoes, saldo acumulado
- Grupo e colapsavel (collapsible), comecando aberto

**4b. Layout de cada transacao dentro do grupo:**
- Coluna esquerda: checkbox + dia/mes
- Centro: descricao + badges (FIXO, parcela) + hierarquia de categoria (CATEGORIA > SUBCATEGORIA)
- Direita: valor formatado (verde/vermelho) + status (LIQUIDADO / 1A PREDITIVA) + menu de acoes (3 pontos)

**4c. Filtros (barra superior):**
- Manter abas REALIZADO / PROJETADO
- Adicionar campo de busca por descricao ou contato
- Dropdown "TODAS CATEGORIAS"
- Filtro de periodo (data inicio / data fim)
- Toggle TUDO / ENTRADAS / SAIDAS

### 5. Layout da Pagina de Categorias (Inspirado na Referencia)

**Problema atual:** As categorias sao listadas em uma unica coluna com arvore expandida por padrao.

**Solucao:**

**5a. Layout em duas colunas:**
- Coluna esquerda: "CANAIS DE RECEITA" (icone verde +) - categorias com `type = 'receita'` ou `type = 'ambos'`
- Coluna direita: "CENTROS DE DESPESA" (icone vermelho x) - categorias com `type = 'despesa'` ou `type = 'ambos'`

**5b. Cada categoria raiz como item colapsavel:**
- Comeca fechado (collapsed) por padrao
- Seta > para expandir, mostra "N SUB-ITENS" como badge
- Ao expandir, mostra subcategorias e sub-subcategorias indentadas

**5c. Adicionar categoria inline:**
- Manter o select "DESPESA/RECEITA" + input "Novo grupo principal..." + botao "+ ADICIONAR" no topo (conforme referencia)

---

### Detalhes Tecnicos

**Arquivos a serem modificados:**

| Arquivo | Mudanca |
|---|---|
| `src/components/lancamentos/TransactionFormModal.tsx` | Filtrar categorias por tipo, melhorar transferencia com wallets/cards, parcelamento avancado com 1a parcela, toggle recorrencia |
| `src/components/lancamentos/TransactionTable.tsx` | Reescrever para layout agrupado por conta com collapsible e badges de categoria hierarquica |
| `src/components/lancamentos/TransactionFilters.tsx` | Adicionar filtro de periodo (datas), toggle entradas/saidas |
| `src/pages/Lancamentos.tsx` | Adaptar para novo formato de filtros (datas, entradas/saidas) e agrupamento |
| `src/hooks/useTransactions.ts` | Adicionar filtros de data, funcao para atualizar serie inteira ao editar parcela, suporte a recorrencia |
| `src/pages/Categorias.tsx` | Reescrever layout em duas colunas (Receita vs Despesa), itens fechados por padrao |
| `src/components/categorias/CategoryTreeItem.tsx` | Ajustar para comecar fechado, mostrar contagem de sub-itens, estilo mais limpo |

**Logica de filtragem de categorias por tipo:**
```text
Se aba = "receita" -> mostrar categorias onde type IN ('receita', 'ambos')
Se aba = "despesa" -> mostrar categorias onde type IN ('despesa', 'ambos')
```

**Logica de deteccao de juros ao editar parcela:**
```text
1. Usuario edita parcela N de uma serie
2. Sistema busca todas as parcelas da mesma series_id
3. Calcula nova soma total
4. Se nova_soma > original_amount da serie:
   - Exibe dialog: "Valor excedeu em R$ X. E juros ou ajuste?"
   - Se juros: adiciona nota automatica "Juros: +R$ X"
   - Atualiza original_amount em todas as parcelas
```

**Agrupamento de transacoes por conta:**
```text
1. Buscar transacoes normalmente (ja filtradas)
2. No frontend, agrupar por bank_account_id || wallet_id || credit_card_id
3. Para cada grupo, calcular saldo acumulado (receitas - despesas)
4. Transacoes sem conta vinculada ficam em grupo "Sem conta"
```

**Nenhuma migracao de banco necessaria** - todas as colunas e tabelas ja existem.

