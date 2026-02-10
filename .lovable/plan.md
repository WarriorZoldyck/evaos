

## Reorganizacao do Formulario de Lancamentos

O cliente solicitou uma nova ordem dos campos no modal de criacao/edicao de lancamentos, alem de alguns comportamentos novos. Segue o plano detalhado:

---

### 1. Adicionar seletor de Contexto (Pessoal/Empresa) dentro do modal

**Arquivo:** `src/components/lancamentos/TransactionFormModal.tsx`

- Adicionar um campo no topo do formulario (antes de tudo) permitindo escolher o contexto do lancamento: "Pessoal" ou uma das empresas do usuario
- Esse campo determina o `company_id` que sera salvo no lancamento
- Isso permite que o usuario nao precise sair do modal para trocar o contexto

### 2. Tipo padrao baseado no contexto

- Quando contexto = Empresa, o modal abre na aba "Receita" por padrao
- Quando contexto = Pessoal, o modal abre na aba "Despesa" por padrao
- O usuario continua podendo alternar livremente entre as abas

### 3. Reordenar os campos do formulario (MainFormContent)

Nova ordem:

| # | Campo | Atual | Mudanca |
|---|---|---|---|
| 1 | Contexto (Pessoal/Empresa) | Nao existe | Novo - Select no topo |
| 2 | Tipo (Receita/Despesa) | Tabs no topo | Ja existe, manter |
| 3 | Status | Linha 3 (com forma pgto) | Mover para cima, sozinho ou com tipo |
| 4 | Descricao | Linha 1 | Mover abaixo do status |
| 5 | Fornecedor/Cliente | Linha 6 | Mover para logo apos descricao |
| 6 | Data de competencia | Linha 2 (segunda) | Mover para apos fornecedor |
| 7 | Data de pagamento | Linha 2 (primeira) | Mover para apos competencia, default = mesma data da competencia |
| 8 | Valor Bruto (R$) | Linha 1 (com descricao) | Mover apos datas, label "Valor Bruto (R$)" com nota de faturamento |
| 9 | Categoria | Linha 4 | Manter posicao relativa |
| 10 | Subcategoria | Linha 4 | Manter |
| 11 | Sub-subcategoria | Linha 4 | Manter |
| 12 | Forma de pagamento | Linha 3 (com status) | Mover para apos categorias |
| 13 | Conta/Maquininha | Linha 5 | Manter apos forma pgto |
| 14 | Resumo (parcelas/MDR) | Linha 7 | Mover para apos contas - serao os toggles de parcelamento + card de MDR |
| 15 | Recorrencia | Linha 7 (junto parcelamento) | Manter apos resumo |
| 16 | Observacoes (notes, barcode, anexo) | Linha 6-7 | Mover para o final |

### 4. Data de pagamento = Data de competencia por padrao

- Ao alterar a data de competencia, a data de pagamento sera atualizada automaticamente para o mesmo valor
- O usuario pode editar a data de pagamento independentemente depois
- Implementar com um `useEffect` que sincroniza quando competencia muda (apenas se pagamento nao foi editado manualmente)

### 5. Label "Valor Bruto" com indicacao de faturamento

- Renomear o label de "Valor (R$)" para "Valor Bruto (R$)"
- Adicionar texto auxiliar pequeno abaixo: "Este valor sera considerado como faturamento"

---

### Arquivos a modificar

| Arquivo | Mudanca |
|---|---|
| `src/components/lancamentos/TransactionFormModal.tsx` | Reordenar campos, adicionar seletor de contexto, logica de tipo padrao, sync de datas, label valor bruto |

### Detalhes tecnicos

- O seletor de contexto usara o estado local `formCompanyId` (separado do contexto global da pagina) para determinar o `company_id` do lancamento
- A logica de sync de datas usara um `useEffect` com flag `paymentDateManuallyEdited` para evitar sobrescrever edicoes manuais do usuario
- A prop `companies` sera passada de `Lancamentos.tsx` (ja disponivel via `useCompany`)
- O `MainFormContent` recebera novas props: `companies`, `isPersonal`, `selectedCompanyId`, e callbacks para contexto
