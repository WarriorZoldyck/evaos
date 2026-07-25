
## O que ajustar no fluxo de Importar Extrato

Foram identificadas 4 fricções na página `/lancamentos/importar-extrato` (arquivos `ImportStatementModal.tsx` e `import/ReconcileStep.tsx`). Todos os ajustes são só de UI/UX + resolução de nome de categoria — nada muda no parser nem no schema.

### 1. Pedir o **mês da fatura** ANTES de subir o PDF (cartão)

Hoje o campo "Qual o mês desta fatura?" aparece só depois do parse, e a heurística já o pré-preenche — quando ela erra (fev vindo como jan), a query de "só no sistema" busca o mês errado.

Mudança:
- Quando `importType === "cartao"`, exibir o campo **Mês da fatura (YYYY-MM)** já no passo inicial (junto do seletor de cartão), **antes** de habilitar o botão de escolher arquivo.
- Enquanto não preenchido: input de arquivo desabilitado com dica "Selecione o mês da fatura para continuar".
- Não pré-preencher automaticamente pela heurística das linhas — só sugerir como placeholder ("ex.: 2026-02"). Manter a marcação `billReferenceMonthTouchedRef` para nunca sobrescrever a escolha do usuário.
- Este mês vira a única fonte da verdade da janela de busca no `useEffect` de órfãos/`systemBill`, no deep-link para Análises EVA e no filtro de reconciliação.

### 2. Botão **"É outra compra — criar"**: só aparecer quando faz sentido

Hoje ele aparece em toda linha da seção "Igual — pode conciliar", com o mesmo efeito prático de "criar do zero" — o usuário estranhou porque na prática, quando o valor é idêntico, ele acaba parecendo um clone do "Manter só o do extrato".

Mudança em `renderMatchRow` (`ReconcileStep.tsx`):
- Só renderizar o botão "É outra compra — criar" quando `best.tier === "tolerance"` **ou** `best.suggested === true` (ou seja, quando o valor difere ou o nome diverge). Na seção "Igual — pode conciliar" (tier `exact` e mesmo nome), o botão some.
- Manter o comportamento: ao clicar, `onActionChange(i, "criar")` — a linha sai da seção "Igual" e entra em "Só no extrato", onde já existe o combobox de categoria (garante que o usuário categorize antes de importar).
- Atualizar a copy do tooltip da seção "Diferença de centavos" e a legenda para deixar explícito: "'É outra compra' desfaz o vínculo; a linha vai para 'Só no extrato' para você categorizar antes de importar."

### 3. **"Manter só o do extrato"** deve herdar a categoria pelo **nome**, nunca por ID

O handler `onKeepStatementOnly` em `ImportStatementModal.tsx` (linha ~1770) hoje faz:

```ts
category: (cand as any).category,
subcategory: (cand as any).subcategory,
subcategory2: (cand as any).subcategory2,
```

O select por trás retorna esses campos como texto na maioria dos casos, mas há candidatos legados com UUID salvo em `category`. Precisa passar por `resolveCategoryName(...)` (já existe no arquivo) antes de escrever em `rowCategories`, garantindo que o combobox mostre e persista o **nome**, nunca o código:

```ts
category: resolveCategoryName(cand.category, mergedCategories) || "",
subcategory: resolveCategoryName(cand.subcategory, mergedCategories),
subcategory2: resolveCategoryName(cand.subcategory2, mergedCategories),
```

Fazer o mesmo tratamento no `CategoryChain` do `renderMatchRow` (já usa `resolveCategoryLabel`, mas confirmar que a normalização é consistente para não mostrar UUIDs em nenhuma célula da tabela de conciliação).

### 4. Deixar claro que "Manter só do extrato" ≠ "É outra compra"

Depois do ajuste 2, os dois botões só coexistem quando faz sentido (valor divergente ou nome divergente). Ainda assim, revisar os tooltips para reforçar a diferença em uma linha:

- **Manter só o do extrato**: substitui o do sistema (exclui + cria com a mesma categoria).
- **É outra compra — criar**: mantém os dois lados (potencial duplicata proposital).

### Fora do escopo

- Parser (`parse-bank-statement`): mantido como está — os problemas apontados são resolvidos por o usuário informar o mês certo antes.
- Nada no backend/DB.
