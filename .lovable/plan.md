## Diagnóstico

O botão **"Criar no sistema"** já funciona tecnicamente — ele executa `onActionChange(i, "criar")`, que grava `matchActions[i] = "criar"` no estado do pai (`ImportStatementModal`). O problema é que essa **também é a ação padrão** de qualquer linha da seção "Só no extrato" (o código faz `matchActions[i] || "criar"`).

Ou seja: a linha já está em `"criar"` desde que apareceu. Clicar de novo em "Criar no sistema" não muda nada — nem visualmente, nem no contador do rodapé (que já mostra "1 criar"). O usuário percebe isso como "botão morto".

A criação de fato acontece só quando ele clica em **"Importar 115 lançamentos…"** no rodapé. O toggle atual serve apenas para **alternar** entre "Criar no sistema" e "Manter só do extrato".

## O que ajustar (só UI/UX da coluna Ação)

Arquivo único: `src/components/lancamentos/import/ReconcileStep.tsx` (bloco lines 915‑962, coluna "Ação" da tabela "Só no extrato").

1. **Deixar claro qual é o estado atual**: o botão do estado ativo passa a ter `aria-pressed="true"`, `data-state="active"` e recebe `cursor-default` + `disabled`‑like feel (mantendo o realce verde/azul). Só o botão da **alternativa** fica clicável.
2. **Tooltip contextual por estado**:
   - Estado ativo → "Ação atual: será criado no sistema ao importar." / "Ação atual: ficará só no extrato."
   - Estado alternativo → "Clique para alternar para X."
3. **Reforçar onde a criação acontece de verdade**: adicionar uma micro‑copy discreta abaixo do toggle no primeiro render (ou no cabeçalho da seção): _"A criação acontece ao clicar em 'Importar N lançamentos' no rodapé."_
4. **Sem mudanças em lógica de negócio**, estado, contadores, ou no fluxo de import. Nenhuma alteração em `ImportStatementModal.tsx` nem no backend.

## Fora do escopo

- Não vou transformar "Criar no sistema" num botão de commit imediato por linha — isso quebraria o fluxo em lote atual (categorização em massa + um único import no fim) e o contador do rodapé.
- Se preferir esse comportamento (criar imediatamente ao clicar, linha some da lista), me diga que faço em plano separado.
