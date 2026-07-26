## Diagnóstico

Rodei duas leituras do modal e o motivo dos 2 lançamentos continuarem sumindo, mesmo após a reimportação com o bloqueio da última rodada, é claro:

1. **`handleImport` só olha `selectedRows`** (`ImportStatementModal.tsx` linha 1194):
   ```ts
   const selectedRows = rows.filter((r) => r.selected);
   ...
   selectedRows.forEach((r) => {
     const action = matchActions[realIdx] || "criar";
     if (action === "ignorar") return;   // ← descarta em silêncio
     ...
   });
   ```
   Qualquer linha com `selected=false` (checkbox desmarcado) ou com `action='ignorar'` (default para linhas "só no extrato") desaparece sem alerta. O bloqueio do rodapé que adicionei antes só contava linhas SEM system match — e mesmo assim ele confia em `explicitlyIgnored`, então uma linha `ignorar` default passa como "pendente" só se o cálculo do rodapé chegar até ela, mas o `handleImport` continua descartando.

2. **Contagem do rodapé (`Importar N`) usa `selectedRows.length`** (linha 2114 / 2110), então quando o usuário desmarca o checkbox, o botão diz "Importar 61" e ninguém percebe que faltam 2.

3. **Nunca há um "toImport" único e coerente**: `handleImport`, o texto do botão e o bloqueio de rodapé usam contagens diferentes → dá pra clicar em Importar com linhas silenciosamente fora.

## Correção

Um único princípio, aplicado em três pontos:

> **Extrato é a fonte da verdade. Nenhuma linha do extrato pode ser descartada sem decisão explícita (`vincular`, `criar` confirmado ou `explicitlyIgnored`).**

### 1. `handleImport` (ImportStatementModal.tsx ~1161–1210)
- Trocar o loop de `selectedRows.forEach` por **`rows.forEach`** (ignora o estado `selected` — ele deixa de ser um filtro de importação e vira apenas "está incluído no lote").
- Antes de qualquer split, computar `pendingIdxs = rows.map((_,i)=>i).filter(i => needsDecision(i))` reusando a mesma função `needsDecision` que o rodapé usa (extrair para um `useMemo`/helper local `getRowDisposition(i): 'link' | 'create' | 'ignore-explicit' | 'pending'`).
- Se `pendingIdxs.length > 0`: **abortar** com toast vermelho listando quantas linhas e o valor total (`fmt(sumPending)`), e rolar para a primeira pendente. Nunca chegar ao insert.
- Para linhas `criar` sem `reviewedRows.has(i)` mas com descrição preenchida → aceitar como criar (fallback já era a intenção); sem descrição → cai em `pendingIdxs`.
- Linhas `action==='ignorar' && !explicitlyIgnored.has(i)` → sempre em `pendingIdxs` (nunca silenciosamente descartadas).

### 2. Unificar o "toImport"
- Criar `const dispositions = useMemo(() => rows.map((_, i) => getRowDisposition(i)), [rows, matchActions, matchTargets, reviewedRows, explicitlyIgnored, matches])`.
- Derivar `toCreate`, `toLink`, `toIgnoreExplicit`, `pending` a partir daí.
- Botão do rodapé (linha 2110): `disabled = importing || pending > 0 || blockedByDivergence || !targetBankAccount || ...` e label = `Importar ${toCreate + toLink} (${toLink} conciliar + ${toCreate} criar)`.
- Remover o filtro por `selectedRows.length === 0` do disabled — se o usuário desmarcou tudo mas há pendentes, o bloqueio de pendentes já cobre; se marcou "Ignorar de vez" em tudo, `pending=0` e `toCreate+toLink=0` → botão fica desativado com tooltip "Nada a importar".

### 3. `ReconcileStep.tsx` — remover o checkbox como caminho de descarte
- O checkbox por linha (linha 1796) hoje serve como "não faz nada com essa linha", o que colide com a nova regra. Duas opções:
  - **Preferida:** remover o checkbox individual da tabela de conciliação (mantendo só a etapa anterior, se existir, para escolher quais linhas do PDF entram no lote). Se a linha entrou no fluxo de conciliação, ela precisa de decisão.
  - Alternativa mínima (se remover for muito invasivo em outro passo): manter checkbox só como atalho visual, mas ignorá-lo em `handleImport` (já feito no item 1).
- Ajustar contadores do rodapé/cabeçalho (`selectedRows.length` → `rows.length` ou `toCreate+toLink+toIgnoreExplicit`).

### 4. Recuperação dos R$ 118,61 já perdidos
- Reabrir a fatura de 21/07/2026 do MASTERCARD BLACK (`espclin`).
- Reimportar o mesmo PDF — com a correção, se o usuário tentar clicar Importar deixando as 2 linhas fora, o modal agora **abortará** com a lista exata.

## Fora do escopo
- Sem mudanças em schema, edge functions ou no algoritmo de matching.
- Sem mexer no `useImportMatching` nem no `CategoryCascadeSelect`.

## Como verificar
1. Reabrir a fatura afetada, reimportar o PDF, deixar propositalmente 1 linha sem confirmar → botão fica desabilitado com "1 lançamento (R$ X) sem decisão".
2. Desmarcar o checkbox de uma linha → mesmo bloqueio (checkbox não descarta mais).
3. Marcar "Ignorar de vez" nas 2 linhas divergentes → botão libera e importa só o resto, sem sumiço silencioso.
4. Fluxo feliz (todas revisadas) → soma criada + vinculada bate exatamente com o total do extrato.
