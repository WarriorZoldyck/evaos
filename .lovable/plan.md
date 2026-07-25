## Plano

1. **Padronizar a regra do toggle**
   - Definir explicitamente: toggle ligado = `criar`; toggle desligado = `ignorar`.
   - Usar essa mesma regra na linha, nos contadores do rodapé e no `handleImport`, evitando qualquer leitura invertida.

2. **Ajustar o visual sem mudar o formato da seção**
   - Manter a linha dentro de “Só no extrato — o que fazer?” quando estiver desligada.
   - Colocar o texto à esquerda do toggle, como solicitado:
     - desligado: `Ignorar` + toggle cinza
     - ligado: `Criar` + toggle azul
   - Não mover a linha para “Ignorados” quando o usuário apenas desligar o toggle nessa seção.

3. **Evitar conflito de clique/tooltip**
   - Tirar o toggle de dentro de qualquer wrapper que possa capturar o clique de forma ambígua.
   - Deixar o `NeuToggle` como botão controlado, recebendo `checked={ação === "criar"}` e enviando `criar/ignorar` diretamente.

4. **Garantir que importar respeite o estado visual**
   - Se a linha estiver com `Ignorar`, ela não entra em `rowsToCreate`.
   - Se estiver com `Criar`, ela entra em `rowsToCreate`.
   - Conferir que o resumo do rodapé mostra a mesma verdade do toggle antes de importar.