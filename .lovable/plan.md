# Ajustes na etapa de conciliação da importação

## 1. Inverter a lógica do switch "Criar ao importar" (opt-in)

Hoje toda linha da seção **"Só no extrato"** entra com `matchActions[i] = "criar"` por padrão — o switch nasce ligado e o usuário precisa desligar para pular. O usuário quer o inverso: **o switch nasce desligado** e só vira criação quando ele clica.

Mudanças em `src/components/lancamentos/ImportStatementModal.tsx` e `src/components/lancamentos/import/ReconcileStep.tsx`:

- Para linhas órfãs (sem candidato do sistema) o default passa a ser `"ignorar"` em vez de `"criar"`. Todos os `matchActions[i] || "criar"` desses caminhos viram `matchActions[i] || "ignorar"` (nas contagens do rodapé, `handleImport`, `newRows` e no `ReconcileStep`).
- Linhas com sugestão de vínculo (`"vincular"`) continuam iguais — não são afetadas.
- Contadores do cabeçalho da seção ("N serão criadas · M ignoradas") e do rodapé ("X conciliar + Y criar") passam a refletir o novo default (começa em `0 criar`, `N ignoradas`).
- Ação em bulk **"Marcar todas para criar"** continua funcionando como atalho para ligar todas de uma vez.
- Badge de linha muda de "Será criado ao importar" (verde) para "Não será importado" (cinza) por padrão. Vira verde quando o usuário liga o switch.
- Tooltip do switch continua explicando os dois estados.

## 2. Redistribuir o rodapé fixo e o botão de cancelar

Hoje o rodapé mistura Voltar + Cancelar num canto e joga input + 3 linhas de texto + botão azul empilhados do outro lado. Fica apertado e o Cancelar some visualmente.

Mudanças só de layout em `src/components/lancamentos/ImportStatementModal.tsx` (footer da etapa `reconcile`, linhas 1929–2037):

- Três colunas no rodapé (desktop): 
  1. Esquerda: **Voltar** (outline). 
  2. Centro: bloco compacto com "Total informado pelo banco" (input), contagens (`X conciliar · Y criar · Z ignorar`), "Total no extrato após import" e status de divergência empilhados em duas linhas curtas. 
  3. Direita: **Importar N** (CTA principal) + **Cancelar importação** como link discreto logo abaixo/à esquerda do CTA, ganhando destaque próprio em vez de ficar colado no Voltar.
- No mobile: empilha em ordem `Cancelar importação` (topo, link), `Voltar` + `Importar` (linha), bloco de totais logo abaixo.
- Manter comportamento sticky, `bg-background/95` e o gate de divergência.

## Fora de escopo

- Nenhuma alteração na lógica de matching, de sugestão de categorias ou no `handleImport` além dos defaults acima.
- Sem mudança no fluxo "Igual — pode conciliar" nem em "Ignorados".
