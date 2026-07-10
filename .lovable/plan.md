## Botão "Concluir" quando não há nada a importar

### Contexto

No modal `ImportStatementModal.tsx` (passo de conciliação, footer no bloco `cartao`/`debito`), o único botão de ação é `Importar N lançamentos`. Ele fica **desabilitado** quando `toImport === 0` (ou seja, `counts.vincular + counts.criar === 0`). Isso acontece, por exemplo, quando o extrato bateu 100% com o sistema e o usuário marcou tudo como **"Manter só o do sistema"** (ignorar). O usuário só tem o `X` no canto para sair, e não fica claro se isso "salva" alguma coisa (na prática, ignorar não altera nada — mas visualmente confunde).

### Mudança

Arquivo: `src/components/lancamentos/ImportStatementModal.tsx` — footer do passo `reconcile` (linhas ~1598-1607, e o equivalente no bloco `débito` ~1471-1485).

Quando `toImport === 0` (nada a criar nem vincular), **substituir** o botão `Importar` desabilitado por um botão `Concluir` habilitado que chama `handleClose()`. Comportamento:

- **`toImport > 0`** → mantém `Importar N lançamentos` como está hoje (aplica vínculos + cria novos).
- **`toImport === 0`** → renderiza `Concluir` (ícone `Check`, variant default) que fecha o modal. Copy: *"Nada a importar — concluir"* com tooltip curto explicando que todas as linhas foram tratadas como "manter só o do sistema" / "ignorar", então nada precisa ser salvo.
- Manter o `X` do canto funcionando como cancelar (sem mudança).

Aplicar a mesma lógica nos dois footers (cartão e débito) para consistência.

### Fora do escopo

- Não mexer em `handleImport`, matching, ou lógica de reconciliação.
- Não mudar `X` do header.
- Só troca visual/UX do CTA final.
