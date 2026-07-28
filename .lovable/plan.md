## Objetivo

Manter a sessão de conciliação viva quando o usuário sai da tela ou recarrega. Só perde o progresso se ele **cancelar** ou **concluir** a importação.

## Comportamento

- Ao subir o PDF/parse: começa uma "sessão de importação" salva no `localStorage`.
- Ao mudar qualquer campo relevante (linhas, matches, categorias, descrições, contatos, `explicitlyIgnored`, `reviewedRows`, etc.): salva com debounce.
- Ao reabrir a página (`/lancamentos/importar`, ou reabrir o modal): se houver sessão salva, exibe um banner no topo do wizard:
  > "Retomar importação de `<nome do arquivo>` (`<N>` linhas, iniciada em `<data/hora>`)? [Retomar] [Descartar]".
  - **Retomar** → restaura estado (`rows`, `step`, matches, decisões etc.) e continua exatamente de onde parou.
  - **Descartar** → apaga a sessão e começa do zero.
- Limpa a sessão automaticamente quando:
  - `handleImport` finaliza com sucesso (chega no `summary`).
  - Usuário clica em **Cancelar/Fechar** de forma explícita — via um botão "Cancelar importação" no rodapé (novo, discreto) — não pela navegação/ESC/reload.
- Fechar por navegação, ESC, refresh, back do browser: **mantém** a sessão.

## Escopo do que persiste

Uma única chave por usuário: `eva.import-session.v1.<user_id>`. Objeto:

```
{
  version: 1,
  savedAt: ISO,
  fileName,
  step,
  importType, targetBankAccount, targetCard, billReferenceMonth,
  statementTotal, statementTotalInput, amountRescaled,
  acknowledgeDivergence,
  rows,                       // ParsedTransaction[]
  matchActions, matchTargets,
  rowCategories, rowDescriptions, rowContacts,
  reviewedRows: number[],     // Set serializado
  explicitlyIgnored: number[],
  replaceDeleteIds: string[],
  extraCategories,
  promotedOrphanIds: string[],
}
```

Não persiste: `orphans`, `matches`, `suggestions`, `suppliersList/clientsList`, `importResult` — são recomputáveis a partir de `rows` + IDs alvo. O arquivo bruto (PDF) não é salvo; se o usuário quiser reprocessar, descarta e recomeça.

## Alterações

### `src/components/lancamentos/ImportStatementModal.tsx`
1. Novo helper `useImportSessionPersistence(state, userId)`:
   - `useEffect` com debounce (~400 ms) que serializa o snapshot no `localStorage` sempre que qualquer dependência muda, mas só quando `rows.length > 0` e `step !== "summary"`.
   - Expõe `clearSession()`.
2. Ao montar (após ter `user.id`): tenta ler a chave. Se existir e `rows.length > 0`:
   - Mantém o estado local vazio, mas seta `pendingResume = snapshot`.
   - Renderiza um banner no topo (dentro do wizard) com botões "Retomar" / "Descartar".
   - **Retomar**: aplica `setRows/setStep/...` a partir do snapshot; limpa `pendingResume`.
   - **Descartar**: `clearSession()` e limpa `pendingResume`.
3. `handleImport` (final do fluxo com sucesso → `step = summary`): chama `clearSession()`.
4. Novo botão "Cancelar importação" no rodapé do wizard (visível quando `rows.length > 0`), que confirma e chama `clearSession()` + `onClose()`.
5. `onClose` padrão (usado por ESC, click fora, back, navegação) **NÃO** limpa a sessão — só fecha o modal.

### `src/pages/ImportarExtrato.tsx`
- Nenhuma mudança de lógica; apenas garantir que `goBack()` continue chamando `onClose` sem sinalizar cancelamento.

## Edge cases

- Sessão de outra conta bancária/tipo: chave inclui `user_id`; ao retomar, se `targetBankAccount` não existir mais (conta apagada), mostra aviso e obriga escolher outra antes de continuar.
- Snapshot muito grande: `rows` limitado a milhares de linhas → OK para `localStorage` (limite ~5 MB). Se `JSON.stringify` falhar por quota, faz `try/catch`, mostra toast discreto "Não foi possível salvar rascunho" e segue.
- Versão futura: campo `version: 1` para invalidar snapshots antigos silenciosamente.
- Multi-abas: última escrita vence (comportamento aceitável; não é fluxo comum).

## Fora de escopo

- Persistir o PDF original.
- Sincronizar rascunho no Supabase (fica só no navegador).
- Múltiplas sessões simultâneas (só uma por usuário).

## Verificação

1. Subir PDF, preencher metade, dar F5 → banner "Retomar" aparece com o nome do arquivo; ao clicar, tudo volta.
2. Sair para outra rota e voltar para `/lancamentos/importar` → mesmo banner.
3. Clicar em "Cancelar importação" → confirma e a sessão some (F5 não oferece retomar).
4. Concluir importação até o `summary` → sessão some automaticamente.
5. Fechar por ESC/back → ao reabrir, banner "Retomar" continua disponível.
