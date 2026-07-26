## Objetivo

Simplificar o fluxo de conciliação: em vez do toggle "Criar" abrir a janelinha `InlineReviewRow` para revisão, a linha já fica editável direto (descrição, categoria, contato) enquanto o toggle está desligado. O toggle passa a funcionar como **confirmar & travar**: ao ligar, salva a edição e bloqueia a linha; ao desligar de novo, destrava para editar. Isso evita erros e garante que ativar o toggle já significa "revisado e pronto para criar".

## Comportamento desejado

- Toggle **desligado** (padrão em linhas "Provável / Criar"):
  - Descrição vira campo editável inline (input na célula "Descrição").
  - `CategoryCascadeSelect` continua editável.
  - Botão pequeno "Contato" (opcional) permite abrir um popover leve para vincular fornecedor/cliente sem sair da linha.
  - A linha NÃO cria nada ainda — é ignorada até o toggle ser ligado.
  - Badge visual "Rascunho / não será criada" para deixar claro.

- Toggle **ligado**:
  - Persiste as edições no estado (`rowDescriptions`, `rowCategories`, `rowContacts`) e marca `reviewedRows.add(i)`.
  - Campos ficam somente-leitura (texto + badge "Revisada, será criada").
  - Nenhuma janelinha `InlineReviewRow` abre automaticamente.

- Toggle desligado novamente:
  - Remove de `reviewedRows`, volta a exibir os campos editáveis.
  - Se o usuário quiser cancelar totalmente, existe atalho "Ignorar de vez" (mantém o comportamento atual de `action=ignorar`).

## Escopo de arquivos

- `src/components/lancamentos/import/ReconcileStep.tsx`
  - Trocar o bloco da célula "Descrição" (linhas ~1280–1332) por um render condicional: input editável quando `!isReviewed`, texto quando `isReviewed`.
  - Ajustar o `NeuToggle` (linhas ~1368–1382): ao ligar, `onActionChange(i, "criar")` + `reviewedRows.add(i)` + NÃO expandir; ao desligar, remover de `reviewedRows` e voltar a ficar editável (mantém `action=criar` como rascunho; a criação só ocorre se `isReviewed`).
  - Remover a expansão automática do `InlineReviewRow` (linhas ~1373–1374 e ~1410–1420). Manter o componente disponível para casos avançados (editar contato), mas acessível via link "mais opções" e não como fluxo primário.
  - Atualizar a lógica de filtragem final para só considerar como "a criar" as linhas com `action==='criar' && reviewedRows.has(i)` (as demais viram rascunho/ignoradas na hora de importar).
  - Ajustar contadores/resumo (`Criar no sistema`, badges "Pendente revisão" vs "Revisada") para refletir o novo estado.

- Mantém `useImportMatching` e demais componentes intactos.

## Detalhes técnicos

- Descrição inline usa `<Input>` controlado por `rowDescriptions[i]`, `onChange` chamando o setter existente (`onDescriptionChange` ou equivalente — verificar prop atual).
- Categoria continua no `CategoryCascadeSelect` já presente.
- Ao ligar o toggle, disparar um pequeno "flush" (garantir que o valor atual no input está em `rowDescriptions` — se estivermos com estado local por debounce, forçar commit no blur/toggle).
- Badge "Rascunho — ligue o toggle para confirmar" quando `action==='criar' && !isReviewed`.
- Botão do rodapé "Importar" deve considerar apenas linhas revisadas como "a criar"; exibir aviso se houver rascunhos ainda desligados ("X linhas em rascunho serão ignoradas — ative o toggle para criar").

## Fora do escopo

- Não altera a lógica de vinculação ("É o mesmo"), fluxo de duplicatas, nem o `CategoryCascadeSelect`.
- Não muda o schema do banco nem edge functions.
