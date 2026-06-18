## Diagnóstico

Inspecionei o vídeo enviado, o arquivo OFX e o `ImportStatementModal.tsx`. O parser do edge function (`parse-bank-statement`) extrai corretamente as 25 transações do OFX do Santander (confirmado pelo "25 de 25 selecionadas" exibido no preview). O problema **não é** no parsing, é no fluxo de UI:

1. **`Tipo de extrato` fica condicionado à conta destino** — em `ImportStatementModal.tsx` linha 522 o select de tipo só é renderizado quando `targetBankAccount` está preenchido (`{targetBankAccount && (...)}`). Se o usuário tem várias contas e não escolhe primeiro, o seletor fica oculto/parece desabilitado.
2. **Tipo nunca é auto-definido para OFX/CSV** — a auto-detecção (linhas 289-315) só seta `importType="cartao"` quando um cartão é casado por dígitos. Para extratos bancários (OFX/CSV) nada é pré-selecionado, então o botão "Importar" fica desabilitado mesmo quando o arquivo está válido. O usuário precisa adivinhar que tem que clicar em "Selecione o tipo" → "Débito em conta".
3. **Bank account não é auto-preenchida quando há só uma** — agrava o item 1.

No vídeo, o usuário tem conta e tipo aparentemente visíveis mas o select de tipo continua mostrando "Selecione o tipo" enquanto o botão importar fica rosa/desabilitado — confirmando que a UX exige passos demais e que o tipo deveria estar pré-selecionado para um OFX (que por natureza é débito em conta).

## Mudanças (somente `src/components/lancamentos/ImportStatementModal.tsx`)

1. **Detectar a extensão do arquivo no upload** (em `handleFileChange`):
   - Guardar `fileExtension` (ofx/qfx/csv/txt/pdf) em um state.
2. **Auto-preencher `importType` após parsing**:
   - Se cartões detectados → `"cartao"` (mantém comportamento atual).
   - Senão, se extensão `.ofx/.qfx/.csv/.txt` → `"debito"` (novo).
   - PDF sem cartão detectado → continua vazio para o usuário escolher.
3. **Auto-selecionar a conta destino quando há apenas uma**:
   - Se `bankAccounts.length + wallets.length === 1` e ainda não há `targetBankAccount`, definir automaticamente.
4. **Remover o gate `{targetBankAccount && (...)}`** do bloco do "Tipo de extrato" (linha 522). Mostrar sempre que houver linhas; assim o select fica sempre clicável e o usuário pode preencher em qualquer ordem.
5. **Mensagem de feedback no toast pós-parsing**: quando for OFX/CSV sem cartão, informar "Extrato bancário detectado — selecione a conta destino" para guiar o usuário.

## Fora do escopo

- Edge function `parse-bank-statement` (funciona, extrai as 25 transações).
- Lógica de cartão de crédito, instalments, datas de competência (intocados).
- Outras telas / modais.

## Verificação

1. Abrir o modal de importar, selecionar o OFX anexado → o seletor "Tipo de extrato" já deve aparecer pré-selecionado como "Débito em conta" e o botão "Importar" deve habilitar assim que a conta destino estiver escolhida.
2. Repetir com PDF de fatura de cartão → continua auto-detectando cartão e preenchendo "Cartão de crédito".
3. Em conta com apenas uma conta bancária na empresa → conta destino vem pré-selecionada.
4. O select "Tipo de extrato" deve estar sempre clicável a partir do momento em que as linhas parseadas aparecem.
