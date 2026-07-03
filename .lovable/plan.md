## Ajustes no card/modal Faturamento

Três correções no drilldown de Faturamento do Dashboard:

### 1. Faturamento deve ser BRUTO (antes do MDR)

Hoje `summary.faturamento` soma `amount` das receitas por competência. Para vendas na maquininha, `amount` já vem **líquido** (com MDR descontado) e o valor bruto fica em `original_amount`.

**Correção em `src/hooks/useDashboardData.ts`:**
- Trocar `Number(t.amount)` por `Number(t.original_amount ?? t.amount)` no cálculo de:
  - `faturamento`
  - `receitaOperacional`
  - `faturamentoNaoMapeado`
- Passar o valor bruto também para o modal (novo campo `grossAmount` em cada Tx exibida).
- Manter `entradas` (regime de caixa) usando `amount` líquido — é o que efetivamente entrou na conta.

Assim: Faturamento = Bruto (bate com nota fiscal / DRE Receita Bruta) e MDR fica visível como despesa separada no card já existente.

### 2. Agrupar por venda (série de parcelas)

Hoje, ao abrir o modal, o Francisco parcelado em 10x aparece 10 vezes. Deve aparecer **uma linha por venda** com resumo tipo "10x no boleto — R$ X" e, ao clicar, expandir para ver as parcelas.

**Correção em `src/components/dashboard/FaturamentoDetailModal.tsx`:**
- Nova estrutura de agrupamento na aba "Lista":
  - Chave de agrupamento: `series_id` (quando existir) ou `id` (venda avulsa).
  - Cada grupo mostra: contato, descrição base, valor **bruto total da venda**, badge com "Nx <método>" (ex.: "10x boleto", "6x cartão", "à vista PIX").
  - Row expansível (chevron) — ao clicar abre sublinhas com cada parcela: nº da parcela, data de competência, data de vencimento/pagamento, status (Pago/Pendente), valor bruto, MDR (se houver) e valor líquido.
- Detectar método de pagamento a partir de: `credit_card_id` → "cartão", `original_amount` presente → "maquininha", senão inferir de `description`/categoria ou exibir método salvo. Buscar dados adicionais necessários (payment_method) — ver seção técnica abaixo.
- Ticket médio passa a ser calculado por **venda** (grupo), não por parcela.
- Contador de "Lançamentos" muda para "Vendas" com número de grupos, e mostra também "N parcelas" em subtítulo.

### 3. Categoria com nome (não UUID)

O modal já aceita `categoryNameResolver`, mas o `Dashboard.tsx` não passa. Consequência: aparece o UUID.

**Correção em `src/pages/Dashboard.tsx`:**
- Expor o `resolveCategoryName` do hook (`useDashboardData`) no retorno.
- Passar `categoryNameResolver={(id) => resolveCategoryName(id).name}` para `<FaturamentoDetailModal />`.

Aplicar o resolver também nas abas "Por categoria" (já usa) e nas sub-parcelas da lista expandida.

---

### Detalhes técnicos

**Campos extras a carregar em `competenceTransactions`** (query em `useDashboardData.ts`):
- `payment_method` (string) — para exibir "boleto / pix / cartão / dinheiro".
- Já temos: `series_id`, `installment_number`, `installments_total`, `original_amount`, `credit_card_id`, `contact_name`, `status`, `competence_date`, `payment_date`, `category`, `description`, `amount`.

**Regras de agrupamento:**
```text
grupo.total_bruto = Σ (original_amount ?? amount) das parcelas
grupo.total_liquido = Σ amount
grupo.mdr = total_bruto - total_liquido
grupo.parcelas = ordenar por installment_number ASC
grupo.label_metodo:
  - se installments_total > 1 → "{installments_total}x {método}"
  - senão → "à vista {método}"
```

**Arquivos alterados:**
- `src/hooks/useDashboardData.ts` — faturamento bruto + expor `resolveCategoryName` + incluir `payment_method` no select.
- `src/components/dashboard/FaturamentoDetailModal.tsx` — agrupamento por venda, linhas expansíveis, ticket médio por venda.
- `src/pages/Dashboard.tsx` — passar `categoryNameResolver` para o modal.

Sem mudanças de schema, sem mudança no card do MDR.
