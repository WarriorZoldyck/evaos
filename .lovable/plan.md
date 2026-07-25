## Ajustes na tela de Importar Extrato

### 1. Remover a barra sticky no topo, voltar tudo para o rodapé
Na etapa **Conciliar & Categorizar**, o rodapé volta a ser o único lugar com os controles principais, alinhados numa mesma linha:

```
[← Voltar]   [Total informado pelo banco: R$ ____]   [resumo N conciliar · N criar · N ignorar]   [Cancelar importação] [Importar N]
```

Mudanças em `src/components/lancamentos/ImportStatementModal.tsx`:
- Remover o bloco "Sticky top bar" (linhas ~2056–2127) da branch `isPage`. O topo da página fica limpo, como era antes.
- Reformar o `DialogFooter` da etapa `reconcile` para ser um `flex` de 3 zonas (esquerda / centro / direita) e continuar `sticky bottom-0` com fundo opaco.
  - Esquerda: `Voltar` (aparece nas etapas reconcile e summary), `Cancelar importação` como link discreto ao lado.
  - Centro: input "Total informado pelo banco (R$)" + indicador `(detectado)` + mensagens de divergência/checkbox de acknowledge (só na etapa reconcile).
  - Direita: contadores (`N conciliar · N criar · N ignorar`), total após import e o botão `Importar N (…)`.
- Na etapa `preview`, manter só `Cancelar importação` + `Próximo` no rodapé sticky.
- Na etapa `summary`, manter `Voltar` + `Fechar` + `Ver novos para categorizar` no rodapé sticky.

Nada é movido para o topo da página — o `AppLayout` já mantém seu cabeçalho global fixo, e o rodapé passa a concentrar o que estava indevidamente no topo.

### 2. Corrigir o NeuToggle para realmente ativar/desativar

O componente atual usa `<input type="checkbox" style="display:none">` dentro do label, mas isso não está refletindo o estado visual (fica sempre no formato "desligado" ou "muda de forma sem virar azul"). Vou reescrever `src/components/ui/neu-toggle.tsx` seguindo fielmente o HTML/CSS que você enviou:

- Estrutura `label > input.toggle + div.indicator` (input e indicator irmãos diretos, na mesma ordem do exemplo).
- Trocar `display: none` do input por `opacity: 0; position: absolute; inset: 0` para garantir que o seletor `~` e o clique via label funcionem em todos os browsers, sem sumir o input do fluxo.
- Usar `data-state="on" | "off"` no label como fallback e aplicar o estilo "ligado" tanto por `:checked ~ .indicator` quanto por `[data-state="on"] .indicator` — assim o estado visual acompanha React mesmo se o CSS injetado inline sofrer purga.
- Manter as cores/sombras do exemplo (fundo `#ecf0f3`, gradiente azul `#4da3ff → #007bff` quando ligado).
- Preservar a API atual (`checked`, `onCheckedChange`, `ariaLabel`, `disabled`) — nenhuma mudança necessária no `ReconcileStep.tsx`.

### Escopo

Apenas os dois arquivos:
- `src/components/lancamentos/ImportStatementModal.tsx` (rodapé sticky reorganizado, sticky top removido)
- `src/components/ui/neu-toggle.tsx` (reescrita para funcionar)

Sem mudanças de lógica de negócio, conciliação, IA ou banco.
