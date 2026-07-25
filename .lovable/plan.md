## Voltar "Criar no sistema" a ser marcação (commit só no final)

Clicar em **"Criar no sistema"** volta a apenas **marcar** a linha. A criação acontece **uma única vez, no final**, quando o usuário clica em **"Importar N lançamentos"** no rodapé — como estava antes.

### Por que isso também mata o bug dos "lançamentos repetidos"

No vídeo, depois de "Criar agora" o painel **"Só no sistema"** enche de itens espelhando o extrato (SCP BÁSICO, ALLIANZ SEGU, AUGUSTA PADARIA...). Não é bug de duplicação nova: é o `handleCreateOne` que:

1. Grava o lançamento no banco na hora.
2. Deseleciona a linha do extrato correspondente.
3. Dispara `transaction-created` → o refetch de órfãos roda no meio da conciliação.
4. O lançamento recém-criado aparece como "órfão" (não casa com nenhuma linha selecionada) e cai em **"Só no sistema"**.

Tirando o commit imediato, nada é gravado no meio, nenhum refetch dispara, e órfãos param de aparecer espelhando o extrato. A gravação em lote no `handleImport` do rodapé continua funcionando igual — cada linha vira exatamente um lançamento, sem duplicata.

### O que vou mudar

**`src/components/lancamentos/import/ReconcileStep.tsx`**
- Remover o caminho de "criar imediato" no botão. O clique volta a só alternar a marcação da linha entre `criar` e `ignorar` (sem chamada ao Supabase, sem spinner, sem remover a linha da lista).
- Voltar o label fixo para **"Criar no sistema"** e ajustar o tooltip: _"Esta linha será criada no sistema quando você clicar em Importar no rodapé."_
- Tirar as props `onCreateNow` e `creatingRowIndices` da interface.

**`src/components/lancamentos/ImportStatementModal.tsx`**
- Parar de passar `onCreateNow` / `creatingRowIndices` para o `ReconcileStep`.
- Remover `handleCreateOne`, o state `creatingRowIndices` e o helper `buildInsertForRow` que só serviam ao commit imediato. O `handleImport` do rodapé é quem cria tudo em lote no final.

### O que fica como está

- Rodapé sticky com **"Cancelar importação"** à esquerda em todas as etapas.
- Total do **"Extrato original"** líquido (despesas − receitas), batendo com a fatura.
- **"Manter só do extrato"** continua como marcação da linha, aplicada no import final.

### Resultado

- Clique em "Criar no sistema" só marca a linha — nada some, nada re-embaralha.
- Nenhum lançamento espelhado aparece em "Só no sistema" no meio da conciliação.
- A criação em lote acontece uma única vez, quando o usuário confirma o "Importar N lançamentos".