# Corrigir perda de decisões na conciliação (conta simoespaula)

## O que realmente aconteceu

Não é "dado fantasma" aleatório: é um bug reproduzível.

Na tela de conciliação existem **duas informações separadas** por linha:
- o **visual** do toggle/selo "Confirmada" (guardado em `reviewedRows`);
- a **decisão** que o salvamento usa (`matchActions`: vincular / criar / ignorar).

O efeito que roda o motor de correspondência (`ImportStatementModal.tsx`, efeito das linhas 1123–1260) **substitui o mapa inteiro de decisões** (`setMatchActions(nextActions)`) toda vez que a lista de linhas muda — inclusive logo depois de "Retomar" o rascunho, e também quando o usuário marca/desmarca qualquer checkbox de linha. Nesse recálculo, toda linha sem par volta a nascer como **"ignorar"**.

O selo verde "Confirmada" **não** é recalculado, então a tela continua mostrando tudo confirmado enquanto, por baixo, as linhas voltaram para "ignorar". Resultado exatamente igual ao do vídeo: 130 linhas na tela, todas confirmadas, e o rodapé oferecendo "Importar 18 (17 conciliar + 1 criar)" com divergência de R$ 16.065,48 — que é justamente a soma das linhas que ela havia confirmado antes da queda.

Agrava o problema uma incoerência de padrão: o `ReconcileStep` trata linha sem decisão como **"criar"** (`matchActions[i] || "criar"`, em várias contagens), enquanto o salvamento trata como **"ignorar"**. Ou seja, a tela conta de um jeito e o commit de outro.

Confirmação nos dados: na conta `simoespaula@gmail.com` foram gravados 43 lançamentos em 17/08 (23:51–23:56 UTC) somando R$ 21.215,64 — apenas o que passou pelo funil, coerente com o relato de que a maior parte da fatura ficou de fora.

## O que será feito

1. **Nunca mais sobrescrever decisões do usuário.** O recálculo de correspondência passa a fazer *merge*: só define ação para linhas que ainda não têm decisão registrada. Linhas confirmadas, ignoradas ou vinculadas manualmente ficam intocadas quando o matcher roda de novo.
2. **Uma única fonte de verdade.** A decisão da linha passa a ser derivada em um único lugar (mesma função usada pela tela e pelo salvamento), eliminando a divergência entre "padrão criar" (tela) e "padrão ignorar" (commit).
3. **Reconciliar selo e decisão.** Ao retomar um rascunho, toda linha marcada como "Confirmada" é reposta como "criar", e toda linha "ignorar" volta como ignorada — o que está na tela é o que será salvo. Se por qualquer motivo restar inconsistência, a linha aparece destacada em vez de sumir silenciosamente.
4. **Salvamento contínuo do progresso (pedido da Paula).** O rascunho passa a ser gravado imediatamente a cada decisão (e não só em debounce de 400 ms), com carimbo de "salvo às HH:MM" visível no cabeçalho da conciliação, para ela poder fechar e voltar depois com segurança.
5. **Aviso honesto antes de importar.** Se o número de linhas confirmadas na tela não bater com o número que o botão vai importar, o sistema bloqueia e explica a diferença, em vez de importar parcialmente.

## Recuperar a fatura dela agora

Depois da correção, ela reabre a importação e retoma o rascunho: as confirmações voltam a valer e a importação sai completa. Os 43 lançamentos já criados em 17/08 serão reconhecidos pelo motor como pares existentes ("conciliar"), não duplicados — isso será verificado com ela antes do envio final. Se sobrar qualquer linha já criada sem par, ela cai na seção "Só no sistema" para vínculo manual.

## Detalhes técnicos

- `src/components/lancamentos/ImportStatementModal.tsx`
  - efeito de matching (linhas ~1123–1260, ramos débito e cartão): trocar `setMatchActions(nextActions)` / `setMatchTargets` / `setExplicitlyIgnored` por atualização funcional que preserva chaves já decididas pelo usuário (rastreadas por um `Set` de índices "tocados").
  - `resumeSession`: backfill `matchActions[i] = "criar"` para todo `i` em `reviewedRows` sem ação; manter o backfill atual de "ignorar".
  - persistência: gravar snapshot de forma síncrona nas mutações de decisão, mantendo o debounce apenas para campos de texto.
  - `getRowDisposition` exportado/compartilhado com o `ReconcileStep`.
- `src/components/lancamentos/import/ReconcileStep.tsx`: substituir todas as ocorrências de `matchActions[i] || "criar"` pelo helper único.
- Teste de regressão (Vitest): dado um snapshot com N linhas "criar"/`reviewedRows`, ao re-executar o matching as decisões permanecem e o total a importar não cai.
- Nenhuma migração de banco.
