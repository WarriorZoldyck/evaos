## Ajustes no fluxo "Criar novo" da conciliação

Objetivo: garantir que toda linha nova criada a partir do extrato passe por uma revisão consciente do usuário (descrição amigável, fornecedor e categoria), sem alterar o comportamento validado de "Manter só o do extrato" nem o de vinculação 1:1.

### O que muda

1. **"Manter só o do extrato"** — sem alteração. Continua substituindo o lançamento do sistema pelo par do extrato preservando categoria por nome (comportamento atual já validado).

2. **Linhas novas ("Só no extrato")** deixam de ir direto para a importação em lote sem revisão. Cada linha nova ganha um botão **"Revisar e criar"** ao lado do toggle Ignorar/Criar. Enquanto a linha não for revisada, ela fica marcada como **"Requer revisão"** e o botão **Importar N** do rodapé bloqueia a submissão se ainda houver linhas `criar` sem revisão (com contador claro: "3 linhas aguardando revisão").

3. **Modal "Revisar novo lançamento"** (novo componente `ReviewNewEntryModal.tsx`) abre com os campos pré-preenchidos vindos do extrato + sugestões do histórico:
   - **Descrição** — editável (ex.: renomear `KAUARA VILARINHO 332/10` → `Formatura Ana`). A descrição original crua fica visível abaixo em cinza como referência ("Original: …") e é preservada em `raw_description` para auditoria.
   - **Fornecedor/Cliente** — `ContactSelectWithCreate` com sugestão pré-selecionada (quando o histórico casa) e opção de criar novo inline. Tipo (fornecedor vs cliente) segue o `type` da linha.
   - **Categoria / Subcategoria / Sub-sub** — `CategoryPathCombobox` já pré-preenchido pela sugestão de histórico; usuário confirma ou altera.
   - **Data e valor** — visíveis, somente leitura (vêm do extrato, não fazem parte da revisão).
   - Ao confirmar, a linha fica marcada como **"Revisada"** (badge verde) e os valores editados são guardados em `rowCategories[i]` + novos campos `rowDescriptions[i]` e `rowContacts[i]`.

4. **Persistência na importação** — o `ImportStatementModal` passa a enviar, para cada linha nova, a descrição editada e o `supplier_id`/`client_id` além da categoria (hoje só categoria). Se o usuário não abrir o modal e mesmo assim tentar importar, o botão fica desabilitado com tooltip explicando o motivo.

5. **Ação "É outra compra — criar"** (já restrita a divergências) passa a levar a linha para "Só no extrato" **e abrir automaticamente o modal de revisão**, já que por definição precisa ser categorizada/renomeada.

### Fora do escopo

- Parser (`parse-bank-statement`), regras de match e cálculos de total permanecem como estão.
- Toggle Ignorar/Criar e layout do rodapé (Voltar / Total do banco / Cancelar) permanecem como estão.
- Nenhuma mudança de schema no banco (usamos campos já existentes de `transactions`: `description`, `supplier_id`, `client_id`, `category`, `subcategory`, `subcategory2`).

### Arquivos afetados

- `src/components/lancamentos/import/ReviewNewEntryModal.tsx` — novo.
- `src/components/lancamentos/import/ReconcileStep.tsx` — botão "Revisar e criar", badge de status por linha, novos props (`rowDescriptions`, `rowContacts`, `onOpenReview`).
- `src/components/lancamentos/ImportStatementModal.tsx` — estado das descrições/contatos revisados, bloqueio do botão Importar quando há pendências, passagem desses campos ao criar as transactions.

### Diagrama do fluxo por linha nova

```text
extrato → linha "Só no extrato"
   │
   ├─ toggle Ignorar     → não entra na importação
   └─ toggle Criar
        │
        ├─ [Revisar e criar]  → modal (descrição, fornecedor, categoria)
        │        └─ confirmar → linha "Revisada" ✓  → entra em Importar N
        └─ sem revisar        → bloqueia Importar N (tooltip "N linhas aguardando revisão")
```
