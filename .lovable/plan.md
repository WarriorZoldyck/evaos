## Diagnóstico

Confirmei nas imagens que os totais do topo (Bruto R$ 28.666, MDR R$ 2.953,45) batem exatamente com a aba "Por cliente/contato". O problema real é outro:

### Bug — MDR aplicado à venda inteira mesmo quando só parte é cartão

Na venda do "Claudio (irmão)" (R$ 12.600), o valor foi pago em partes: R$ 2.000 transferência, R$ 1.000 débito, resto boleto. Hoje a agregação por série faz:

1. `classifyItems` olha o grupo inteiro e retorna UM `kind` (encontrou débito → `kind = "debito"`).
2. Marca a série como cartão (`isCard = true`).
3. Calcula `fee = gross_total − net_total = R$ 12.600 − R$ 10.582 = R$ 2.018` — trata a venda inteira como se fosse toda no cartão.

Resultado: MDR de R$ 2.018 numa venda em que só R$ 1.000 passou em débito. O real seria ~R$ 25 (MDR do débito).

### Bug — "Sem contato" agrupando por `contact_name`

O agrupamento por cliente usa só `contact_name`. Quando não existe contato preenchido, todas as vendas caem em "Sem contato". O correto é cair para a **descrição/cliente do lançamento**.

## Correção

Arquivo único: `src/components/dashboard/FaturamentoDetailModal.tsx`

### 1. Cálculo per-item, depois agrega

Substituir a heurística `max vs sum` por cálculo **por parcela**:

- Para cada `item` da série:
  - Se `isCardItem(item)` (tem `card_terminal_id` ou `payment_method` é crédito/débito):
    - `gross_i = original_amount_i > 0 ? original_amount_i : amount_i`
    - `fee_i = max(0, gross_i − amount_i)`
    - `net_i = amount_i`
  - Senão (boleto/pix/dinheiro/transferência/outros):
    - `gross_i = net_i = amount_i`, `fee_i = 0` (ignora `original_amount` — não há MDR)
- Agregado da venda: soma direto (`gross = Σ gross_i`, `fee = Σ fee_i`, `net = Σ net_i`).
- `hasGross = fee > 0` (mostra colunas MDR/Bruto sempre que existir cartão em qualquer parcela).

Isso corrige exatamente o caso Claudio: transferência e boleto contribuem só com o próprio `amount` (sem MDR), e o débito contribui com o próprio MDR real.

### 2. Filtro por forma de pagamento

Passa a ser "**qualquer parcela ∈ forma X**":

- `saleHasKind(sale, kind)`: `true` se alguma parcela do grupo tem esse kind.
- `paymentFilter` chama `saleHasKind` — permite ver a venda mista quando o usuário filtra por "Débito".
- O `kind` primário (para display do card no sub-dialog e chip) passa a ser calculado por **maior soma de `amount`** dentro do grupo, com fallback "misto" se houver empate ou cartão + não-cartão relevantes.
- Chip da barra de filtros mostra todas as formas presentes nas vendas visíveis (`availableKinds` continua igual).

### 3. Sub-dialog de detalhes por venda

Na tabela de parcelas do sub-dialog, adicionar coluna **Forma** por parcela (crédito/débito/boleto/…) e uma coluna **MDR** só preenchida quando aquela parcela específica é cartão. Assim o usuário enxerga exatamente quanto de MDR incide em cada parcela.

### 4. Agrupamento "Por cliente" — fallback para descrição

Trocar o key do `byContact` de `t.contact_name || "Sem contato"` para:

```
t.contact_name?.trim() || t.description?.trim() || "Sem cliente"
```

E renomear a aba/rótulo interno de "Por cliente/contato" para **"Por cliente"** (mantém a semântica, evita confusão).

### 5. Sanidade

Depois do fix, os totais do topo continuam sendo `Σ` das linhas visíveis (Lista == cards == Por mês == Por categoria == Por cliente, dentro do subset filtrado).

Nenhuma alteração em banco, hooks ou outras telas.
