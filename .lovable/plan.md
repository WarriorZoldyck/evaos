
## Contexto

O undo já reverteu os badges por linha, contadores e switch shadcn na seção "Só no extrato". A lógica atual (marcar `criar` vs `ignorar`, commit em lote no botão do rodapé) fica mantida — só ajustamos apresentação.

## Mudanças

### 1. Cabeçalho único na mesma altura — `ImportStatementModal.tsx` (variant `page`)

Hoje o topo tem duas linhas: uma com "Voltar" + título "Importar Extrato" + ícone banco/data, outra com "Cancelar importação". E o total do extrato aparece só dentro do card na etapa de conciliação.

Passa a ser **uma única barra sticky** com três zonas:

```text
[← Voltar]   [Banco • Data • Total informado R$ X.XXX,XX]   [Cancelar importação ✕]
```

- Esquerda: botão `← Voltar` (etapa anterior / fecha se for a primeira).
- Centro: metadados do extrato (banco/cartão, período, total informado pelo banco — mesmo dado que hoje aparece dentro do card "Extrato original", trazido pro header).
- Direita: `Cancelar importação` (mantém comportamento atual, fecha a rota).
- Sticky com `bg-background` sólido + border-bottom; z-index acima do conteúdo. Some o "header duplicado" que existia na etapa reconcile.

### 2. Toggle neumórfico Uiverse — nova primitiva `src/components/ui/neu-toggle.tsx`

- Componente controlado: `<NeuToggle checked onCheckedChange aria-label />`.
- HTML/CSS exatos do snippet fornecido (label > toggle > input + indicator), estilo neumórfico com estado ligado em gradiente azul.
- CSS colocalizado no arquivo via `<style>` scoped por classe única (`neu-toggle`) pra não vazar globalmente e não depender de `index.css`.
- Sem hardcode de cores no consumidor — o componente encapsula.

### 3. Uso do NeuToggle em "Só no extrato" — `ReconcileStep.tsx`

- Substituir o par de botões `Criar no sistema` / `Manter só do extrato` pelo `NeuToggle` na coluna Ação.
- Ligado = `criar` (padrão), desligado = `ignorar`.
- Ao lado do toggle, um label curto reflete o estado: **"Criar"** (ligado) / **"Ignorar"** (desligado), pra não depender só da cor.
- Tooltip mantém a explicação "A criação acontece ao clicar em Importar no rodapé".
- Sem badges por linha, sem contadores no cabeçalho da seção, sem bulk actions, sem dimming — nada do que foi revertido volta.

### 4. O que NÃO muda

- Botão `Importar N lançamentos` do rodapé permanece como está (label atual, sem breakdown extra).
- Lógica de matching, ordem, categorias, seções "Igual" e "Só no sistema" — intocadas.
- Rodapé sticky já existente permanece.

## Resultado

- Topo com uma linha só, voltar + info do extrato + cancelar, tudo alinhado verticalmente.
- Toggle bonito neumórfico substitui o switch/botões atuais na coluna Ação.
- Comportamento de commit em lote preservado (sem o bug de "aparecer tudo repetido").
