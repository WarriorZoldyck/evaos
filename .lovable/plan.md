## Plano

1. **Manter o formato atual da seção**
   - Não vou reorganizar cabeçalho, tabela, badges, rodapé ou a estrutura visual da seção “Só no extrato”.
   - A mudança fica restrita ao comportamento/visual do toggle e ao estado da linha quando ele é desligado.

2. **Corrigir o toggle para ligar/desligar de verdade**
   - Ajustar o `NeuToggle` para usar um botão controlado (`button role="switch"`) em vez de depender de `input` invisível dentro de `label`, evitando clique confuso ou estado visual travado.
   - O clique vai alternar diretamente `Criar` ↔ `Ignorar` usando o estado React atual.

3. **Preservar o mesmo desenho do toggle**
   - Manter o estilo neumórfico e o mesmo tamanho geral.
   - Apenas trocar a posição/cor do indicador conforme ligado/desligado, sem mudar o formato da linha/tabela.

4. **Feedback claro sem deformar a seção**
   - Quando ligado: texto “Criar”.
   - Quando desligado: texto “Ignorar”.
   - Se precisar indicar “não será importado”, manter como badge discreto onde já existe hoje, sem alterar a estrutura da sessão.

5. **Validar no preview**
   - Abrir a rota de importação e testar o clique no toggle.
   - Confirmar que o contador de criar/ignorar muda e que a linha não muda de formato, apenas estado visual.