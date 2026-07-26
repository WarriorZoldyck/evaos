## Ajustes finos na conciliação (rodada 2)

### 1. Renomear e re-semantizar "Manter só o do sistema" → **"É o mesmo"**

Você tem razão: se o lançamento do sistema é o mesmo do extrato, o certo é apenas **reconhecer o vínculo** — não descartar nenhum dos dois. Já existe essa ação hoje na seção Provável ("É o mesmo" = `vincular`).

- Trocar o botão amarelo "Manter só o do sistema" pela ação existente `vincular` com o rótulo **"É o mesmo"** e o mesmo ícone/estilo do botão da seção Provável.
- Comportamento: marca a linha do sistema como conciliada (`is_reconciled = true`, `status = 'Pago'` se estava `Pendente`, `reconciled_at = now()`) e **não insere nada novo**. A linha do extrato serve só de "prova" e não vira uma segunda transação.
- Contadores do rodapé: essa linha entra em **"conciliar"** (não em "ignorar"), então o "Selecionado líquido" continua batendo com o total do banco. Isso resolve a divergência falsa que aparecia nas prints (−R$ 60,00 esperado R$ 8.514,66).
- "Manter só o do extrato" permanece como está (substitui o lançamento do sistema pelo do extrato preservando o nome da categoria).
- Tooltip curto ao lado dos dois botões explicando cada um em uma linha.

### 2. Bug — "Revisar e criar" não abre o modal

Provável causa (a confirmar em build): `reviewIdx` aponta para `rows[reviewIdx]` no `ImportStatementModal`, mas o `ReconcileStep` chama `onOpenReview(i)` com o índice da tabela filtrada de "Só no extrato", não o índice global de `rows`. Resultado: `reviewRow` volta `undefined` e o modal não abre.

- Em `ReconcileStep.tsx`, propagar o `i` **original** (o mesmo já usado em `onActionChange(i, …)`, que é o índice global) para o `onOpenReview`. Auditar todos os pontos de chamada.
- Garantir também que os botões "Criar novo" (Provável) e "É outra compra — criar" chamem `onOpenReview(i)` logo após `onActionChange(i, "criar")` — o "Revisar e criar" fica como caminho manual/fallback.
- Verificar no console após o fix: clicar em "Revisar e criar" precisa abrir o modal com descrição do extrato pré-preenchida.

### 3. Compactar a barra de resumo "Sistema × Extrato"

Hoje o header amarelo ocupa ~180px e empurra a lista para fora da viewport (visível na print image-220).

- Reduzir para uma linha só, alinhamento horizontal:
  `⚠ Sistema × Extrato — Sistema: −R$ 564,33 · Extrato: R$ 8.514,66 · Diferença: +R$ 7.950,33 · 9/63 conciliadas`
- Mover "Prováveis causas da divergência" para um `Popover` acionado por um ícone de info ao lado da diferença.
- Reduzir padding vertical (`py-2` em vez de `py-4`) e remover a linha "Cada linha cai em um dos 4 cenários" ou fundi-la como legenda pequena logo abaixo.
- Meta: barra em ≤ 56px de altura para liberar espaço para a lista.

### 4. Fora do escopo

- Layout do rodapé (Voltar / Total do banco / Cancelar / Importar), toggle Ignorar/Criar da seção "Só no extrato" e parser continuam como estão.
- Nenhuma mudança de schema.

### Arquivos afetados

- `src/components/lancamentos/import/ReconcileStep.tsx` — botão "É o mesmo" no lugar de "Manter só do sistema", correção do índice em `onOpenReview`, auto-abertura do modal em "Criar novo"/"É outra compra".
- `src/components/lancamentos/ImportStatementModal.tsx` — compactação da barra de resumo, popover para causas, contadores atualizados (linha "é o mesmo" conta como `conciliar`), garantir que `reviewIdx` referencia o mesmo array indexado pelo `ReconcileStep`.
