
## Objetivo

Aprimorar o modal aberto ao clicar em **Faturamento** no Dashboard para (1) mostrar corretamente Bruto vs MDR vs Líquido, (2) exibir "quem/quando" com clareza, e (3) trocar IDs por **nomes de categoria**. Sem tocar em cálculos financeiros do dashboard nem em outras telas.

## Mudanças

### 1. `src/hooks/useDashboardData.ts`
- Expor `categoryRecords` no retorno do hook para permitir o resolver de nome no modal.

### 2. `src/pages/Dashboard.tsx`
- Consumir `categoryRecords` e construir um `Map<id, name>`.
- Passar `categoryNameResolver={(id) => map.get(id) ?? "Sem categoria"}` para `<FaturamentoDetailModal />`.

### 3. `src/components/dashboard/FaturamentoDetailModal.tsx`

**Tipo `Tx`:** adicionar `original_amount: number | null`, `payment_method: string | null`, `card_terminal_id: string | null` (já disponíveis? incluir só os presentes; usaremos apenas `original_amount`, opcional).

**Regra Bruto vs Líquido (por linha):**
- `gross = Number(t.original_amount ?? t.amount)`
- `net = Number(t.amount)`
- `fee = round2(gross - net)` (só quando `original_amount` existe e é > 0)

**Totais no cabeçalho (4 cards):**
- **Bruto** (soma de `gross`)
- **MDR** (soma de `fee`) — com % efetivo (`fee/gross*100`, 2 casas)
- **Líquido** (soma de `net`) — este é o `total` já vindo por prop
- **Lançamentos** (contagem)
- Adicionar segunda linha compacta: **Ticket médio (bruto)** e **vs período anterior** (mantém compará­vel — usar `prevTotal` como está).
- Todos os valores formatados via `Intl.NumberFormat pt-BR` (2 casas). Arredondar cada linha antes de somar (`Math.round(x*100)/100`) para não acumular erro de ponto flutuante.

**Aba "Lista" (colunas):**
- Competência | Pagamento | Descrição | Contato (quem) | Categoria (nome resolvido) | Bruto | MDR | Líquido
- `Pagamento`: `t.payment_date` (ou "—" se ausente).
- `Contato`: `t.contact_name || "—"`.
- `Categoria`: usar `categoryNameResolver(t.category)` sempre (não exibir UUID cru). Fallback "Sem categoria".
- Colunas `MDR` e `Bruto` só aparecem se pelo menos uma linha tiver `original_amount`; caso contrário mostrar somente `Valor` (líquido) — evita ruído em contextos sem maquininha.

**Aba "Por categoria":**
- Agrupar por **nome** já resolvido (elimina IDs). Somar por `gross` (padrão do "Faturamento") e mostrar também coluna `Líquido` e `MDR` quando aplicável.

**Aba "Por contato" (renomear para "Por cliente/contato"):**
- Agrupar por `contact_name` (fallback "Sem contato"), mesma lógica de Bruto/MDR/Líquido.

**Aba "Por mês":**
- Mesma lógica de colunas Bruto/MDR/Líquido.

**`GroupTable`:** aceitar linhas com `{ label, gross, fee, net, count }` e renderizar colunas condicionais (MDR/Líquido só se algum `fee > 0`). Percentual `% do total` calculado sobre **Bruto**.

**Precisão decimal:** manter todos os valores em número JS mas usar helper local:
```ts
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
```
Aplicar em cada `fee`, agregações por grupo, e nas somas do cabeçalho.

## Escopo / não-escopo
- **Não** altera `useDashboardData` além de expor `categoryRecords`.
- **Não** altera hooks de MDR nem outras páginas.
- **Não** mexe em criação/edição de lançamentos.
