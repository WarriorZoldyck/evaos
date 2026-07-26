## Plano

1. **Padronizar o comportamento do botão “É o mesmo”**
   - Usar um único handler para todos os lugares onde o botão aparece.
   - Ao clicar, definir a ação da linha como `vincular` e salvar o lançamento do sistema como destino.
   - Remover a linha da área onde ela estava causando dúvida visual, quando aplicável.

2. **Dar feedback visual imediato para o usuário**
   - Fazer a linha mudar claramente para um estado conciliado/manual logo após o clique.
   - Exibir um bloco/linha de confirmação “Vinculado manualmente” com as duas pontas: Extrato ↔ EVA.
   - Manter botão “Desfazer” para o usuário reverter sem perder controle.

3. **Corrigir o caso que parece “não fazer nada”**
   - Revisar especialmente o botão “É o mesmo” dentro de “Só no sistema”, porque ali o clique pode estar apenas gravando estado sem deslocar/atualizar a linha de forma perceptível.
   - Garantir que o lançamento do sistema vinculado não continue aparecendo como pendente na lista “Só no sistema”.

4. **Preservar a importação final**
   - Confirmar que linhas marcadas como `vincular` continuam entrando em `rowsToLink` no envio final.
   - Não alterar o fluxo de “Manter só o do extrato” nem o fluxo de criação/categorização.

5. **Validar com logs e preview**
   - Conferir novamente logs do Vite/console após a alteração.
   - Se possível, validar no preview que o clique muda a UI imediatamente e que o estado fica reversível.