
## Escopo

Três ajustes na tela de conciliação (`ReconcileStep` + `ImportStatementModal`):

1. Refatorar o rodapé para eliminar o painel de divergência inline e usar apenas botões compactos.
2. Corrigir o bug de "fornecedor cai na descrição" no parse do extrato.
3. Corrigir o bug do "Criar novo fornecedor/cliente" que salva a descrição no lugar do nome digitado.

---

## 1. Rodapé enxuto + confirmação de divergência

Hoje o rodapé mostra o resumo de divergência (`⚠ Divergência: -R$ X`) em texto inline, o que ainda ocupa espaço e polui a UI.

**Novo layout do rodapé** (`ImportStatementModal.tsx`, área do `ReconcileStep`):

```
[ Voltar ]  [ Cancelar importação ]        [ Total informado pelo banco ]  [ Importar N (R$ Y) ]
```

- **Voltar / Cancelar importação:** mantidos como estão.
- **Total informado pelo banco:** novo botão à esquerda do "Importar".
  - Só aparece quando há divergência entre soma do extrato e soma resolvida.
  - Rótulo: `Total informado pelo banco: R$ X`.
  - Estilo `outline` discreto (não é ação primária).
  - Ao clicar, abre um `AlertDialog` com:
    - Título: "Confirmar divergência".
    - Corpo: total do banco, total resolvido, diferença (positiva/negativa), texto curto explicando que o extrato é a fonte da verdade e pedindo confirmação.
    - Ações: `Cancelar` | `Concordo, importar mesmo assim`.
  - Ao confirmar, `divergenceAcknowledged` vira `true` e o dialog fecha.
- **Importar N (R$ Y):** habilitado quando `counts.pendente === 0` **e** (não há divergência **ou** `divergenceAcknowledged === true`).
  - Se ainda houver pendências: desabilitado com tooltip existente ("X linhas sem decisão").
  - Se houver divergência não confirmada: desabilitado, com tooltip "Confirme a divergência com o total do banco antes de importar".

**Remover:**
- O bloco inline `⚠ Divergência …` do rodapé.
- O `AlertDialog` atual disparado no `onClick` do Importar (a confirmação passa a ser um passo explícito via o novo botão).

**Estados:**
- Já existe `divergenceAcknowledged`; renomear apenas se necessário.
- Remover `confirmDivergenceOpen` / `pendingDivergenceInfo` (substituídos pelo novo dialog controlado pelo botão).

---

## 2. Fornecedor no campo certo + descrição limpa

Em `ImportStatementModal.tsx`, após o parse e o bloco de installments (~L601-650), adicionar pós-processamento:

- Para cada linha `r`:
  - Calcular `cleanName` = `base_description` (se houver) ou `r.description`, normalizado (trim, sem acentos, upper).
  - Procurar em `suppliers` (despesa) ou `clients` (receita) por match exato de nome normalizado.
  - Se encontrar: registrar em `initialRowContacts[i]` o `supplier_id` / `client_id`.
- Buscar a última descrição usada para cada contato encontrado, em uma única query:
  ```ts
  supabase.from("transactions")
    .select("supplier_id, client_id, description, payment_date")
    .or("supplier_id.in.(...),client_id.in.(...)")
    .gte("payment_date", <hoje - 90d>)
    .order("payment_date", { ascending: false });
  ```
  Reduzir para `Map<contactId, lastDescription>`.
- Se `lastDescription` existir **e** for diferente do nome do contato → usar como `initialRowDescriptions[i]`. Caso contrário, deixar em branco (o placeholder do input já mostra `r.description` como referência).
- Se **não** houver contato encontrado: não pré-preencher contato e **deixar a descrição em branco** (o texto original continua acessível via placeholder e via o bloco "Original:" já existente em `ReconcileStep` L1329-1333) — assim o usuário abre "Criar novo" e digita o nome real sem herdar a descrição.

Passar dois novos props ao `ReconcileStep`:
- `initialRowContacts` e `initialRowDescriptions`

E usá-los como valor inicial dos estados `rowContacts` / `rowDescriptions` já mantidos no `ImportStatementModal` (não no `ReconcileStep`, para preservar o auto-save de sessão).

---

## 3. Correção da criação inline de fornecedor/cliente

- `src/components/lancamentos/ContactSelectWithCreate.tsx`: alterar assinatura de `onContactCreated` para `(id: string, name: string)` e chamar `onContactCreated(data.id, newName.trim())` após o insert.
- `src/components/lancamentos/import/ReconcileStep.tsx`: nas duas chamadas (linhas ~300 e ~1345), receber `(id, name)` e propagar `onContactCreated?.(type, id, name)` — remover o uso de `draftDesc` como nome.
- `src/components/lancamentos/TransactionFormModal.tsx`: ajustar a chamada existente para a nova assinatura (só ignorar o segundo argumento se não for necessário lá).

---

## Verificação

- `tsgo` nos três arquivos alterados.
- Fluxo manual:
  1. Importar extrato com uma parcela conhecida (fornecedor existente) → confirmar que o campo Fornecedor vem preenchido e Descrição vem em branco (ou com a descrição usada anteriormente para o fornecedor).
  2. Criar fornecedor inline digitando "Padaria X" → combobox exibe "Padaria X", não a descrição da linha.
  3. Provocar divergência artificial (marcar "Ignorar de vez" em uma linha grande): confirmar que o rodapé mostra o botão "Total informado pelo banco: R$ …", que o Importar está desabilitado, e que o dialog de confirmação libera o Importar.
