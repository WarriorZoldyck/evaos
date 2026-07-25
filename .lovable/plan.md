## Deixar claro visualmente o estado de cada linha em "Só no extrato"

No vídeo, ao clicar em **"Criar no sistema"** nada parece acontecer: o botão já vem selecionado por padrão, o toggle não muda de posição perceptível, e o único sinal de vida é o pequeno contador no rodapé (`X criar · Y ignorar`). O usuário não entende que a criação vai acontecer no final, nem qual é o estado atual da linha.

Vou tornar o estado explícito no próprio corpo da linha, tirar a ambiguidade do toggle e reforçar o CTA do rodapé.

### O que muda

**`src/components/lancamentos/import/ReconcileStep.tsx` — seção "Só no extrato"**

1. **Badge de estado por linha (na coluna Descrição)**
   - Ação = `criar` → chip verde **"✔ Será criado ao importar"** (com o número de ordem quando houver duplicatas: `#3 de 5`).
   - Ação = `ignorar` → chip cinza **"⊘ Não será importado"** + linha inteira com `opacity-60` e categoria desabilitada.
   - Substitui o feedback invisível de hoje: hoje só o botão muda de cor, agora a linha inteira comunica o resultado.

2. **Toggle de ação mais legível**
   - Trocar o par de botões colados por um **Switch shadcn** com label dinâmica:
     - Ligado: **"Criar ao importar"** (verde)
     - Desligado: **"Ignorar esta linha"** (cinza)
   - Elimina a impressão de que "Criar no sistema" é um botão que devia disparar algo agora — Switch comunica estado, não ação.

3. **Mini-resumo fixo no cabeçalho da seção**
   - Ao lado do título "Só no extrato — o que fazer?", exibir contador ao vivo:
     `N serão criadas · M ignoradas` (verde/cinza).
   - Adiciona ações em bulk: **"Marcar todas para criar"** / **"Ignorar todas"**.

4. **Alert reescrito, mais curto**
   - Substituir o parágrafo atual por 2 linhas diretas:
     > Cada linha marcada como **"Criar ao importar"** vira um novo lançamento quando você clicar em **"Importar N lançamentos"** no rodapé. Desligue o switch para pular a linha.

5. **Reforço no botão do rodapé (`ImportStatementModal.tsx`)**
   - Atualizar o label para deixar explícito o que vai ser gravado:
     `Importar (X conciliar + Y criar)`
   - Mantém o botão desabilitado quando `X + Y = 0`.

### O que NÃO muda

- Nada de criação imediata — commit continua sendo em lote no clique do rodapé (evita o bug de "aparecerem repetidos em Só no sistema" que já corrigimos).
- Lógica de matching, sugestões de categoria por histórico, ordenação e cabeçalho sticky permanecem iguais.
- Ações e labels das outras seções ("Igual — pode conciliar", "Só no sistema") não são tocadas.

### Resultado esperado

- O usuário vê, na própria linha, "Será criado ao importar" — sem depender do contador do rodapé para entender.
- Switch com label dinâmica remove a expectativa de que "Criar no sistema" seja um botão de ação imediata.
- Botão do rodapé mostra exatamente quantos lançamentos serão gravados, encerrando a dúvida sobre "o que acontece agora".