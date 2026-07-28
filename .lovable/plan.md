## Objetivo

Reduzir o esforço de digitação na conciliação: pré-preencher Descrição e Fornecedor automaticamente para cada linha do extrato, deixando ambos editáveis apenas quando o usuário clicar no campo.

## Comportamento atual (verificado)

- `ImportStatementModal` já faz o pós-processamento pós-parse e passa `initialRowContacts` / `initialRowDescriptions` para o `ReconcileStep`, mas hoje o fallback deixa descrição em branco quando não há histórico do fornecedor.
- Fornecedor: quando encontra match por nome normalizado, já vem preenchido; quando não encontra, fica vazio e o usuário precisa criar/selecionar.
- Descrição: só vem preenchida se existe transação anterior do mesmo fornecedor nos últimos ~180 dias; senão fica vazia (com o texto do extrato só como placeholder).

Resultado prático: nas telas enviadas, quase todas as linhas aparecem sem descrição e sem fornecedor, exigindo digitação repetida.

## Mudanças propostas

### 1. Descrição sempre pré-preenchida

No pós-processamento do parse em `ImportStatementModal.tsx`:

- Regra nova para `initialRowDescriptions[i]`:
  1. Se existe `lastDescription` do fornecedor casado → usa ela.
  2. Senão, se existe `base_description` (nome limpo do fornecedor, sem parcela) → usa ela.
  3. Senão → usa `r.description` bruta.
- Ou seja, o campo Descrição nunca começa vazio; sempre traz o melhor palpite disponível.

### 2. Fornecedor sempre pré-preenchido quando houver match plausível

Ainda em `ImportStatementModal.tsx`:

- Mantém o match exato por nome normalizado (já existente).
- Adiciona um segundo passo (fallback) quando não houver match exato:
  - Normaliza `base_description` (ou `r.description` sem sufixo de parcela).
  - Faz um match "starts-with" / "contains" contra `suppliers`/`clients` (mesmo `user_id`, respeitando tipo receita/despesa), preferindo o nome mais longo que casa.
  - Se encontrar um único candidato razoável, usa como `initialRowContacts[i]`.
- Se nenhum match: deixa fornecedor vazio (comportamento atual), mas a descrição já traz o texto do extrato pela regra 1.

### 3. UX de edição "click-to-edit" na linha

Em `ReconcileStep.tsx`, quando a linha ainda não foi confirmada (toggle "Criar" desativado):

- **Descrição:** trocar o `Input` sempre visível por um texto exibido "como label" (com o valor pré-preenchido). Ao clicar no texto, ele vira `Input` focado (autofocus, seleciona o conteúdo). Ao dar blur/Enter, volta a virar texto.
- **Fornecedor:** trocar o `Select` sempre aberto por um chip/texto exibindo o nome do fornecedor pré-preenchido (ou "Fornecedor (opcional)" se vazio). Ao clicar, abre o `ContactSelectWithCreate` (mantém a lógica existente de criar novo). Ao selecionar, fecha e volta a exibir como chip.
- Visualmente: usar um hover discreto (`hover:bg-muted/40`, cursor-text no texto de descrição, cursor-pointer no chip do fornecedor) e um ícone `Pencil` pequeno à direita para deixar claro que é editável.
- Quando o toggle "Criar" é ativado, mantém o comportamento atual (campos travados, `pointer-events-none`).

### 4. Coerência com o restante do fluxo

- O placeholder "Original: …" já mostrado na linha continua útil como referência mesmo com a descrição pré-preenchida — mantido.
- Auto-save de sessão (`localStorage`) não muda: os valores pré-preenchidos já entram como `rowDescriptions` / `rowContacts` no estado do `ImportStatementModal`, então são persistidos automaticamente.
- Regra de "sem decisão bloqueia o Importar" não muda: pré-preencher não conta como decisão — o usuário ainda precisa ativar o toggle "Criar", vincular ou "Ignorar de vez".

## Arquivos afetados

- `src/components/lancamentos/ImportStatementModal.tsx` — ajustar regra de `initialRowDescriptions` e adicionar fallback de match de fornecedor.
- `src/components/lancamentos/import/ReconcileStep.tsx` — transformar descrição e fornecedor em campos click-to-edit enquanto a linha não estiver confirmada.

## Verificação

- `tsgo` nos dois arquivos.
- Fluxo manual:
  1. Importar extrato onde vários itens são do mesmo fornecedor já cadastrado → fornecedor vem selecionado, descrição vem com o último texto usado.
  2. Importar itens sem fornecedor cadastrado → descrição vem com o texto do extrato, fornecedor vazio; clicar na descrição permite editar; clicar no fornecedor abre o seletor com opção "Criar novo".
  3. Ativar o toggle "Criar" → campos ficam travados como hoje; desativar → voltam a ser clicáveis.
