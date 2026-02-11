

## Redesign do Formulario de Maquininha - Layout Skeuomorfico

### Conceito

Transformar o formulario atual (modal generico com inputs) em um layout visual que lembra uma maquininha de cartao fisica, usando tons de azul alinhados com a identidade EVA OS.

### Layout Visual

O modal tera um "corpo" de maquininha com:

1. **Topo da maquininha** - Header arredondado azul escuro com o nome/logo da adquirente e um indicador LED (bolinha verde pulsante)
2. **Tela/Display** - Area central com fundo escuro simulando a tela LCD da maquininha, onde ficam os campos de taxa e prazos de liquidacao (D+ Debito, D+ Credito, Taxa Debito, Taxa Credito)
3. **Corpo principal** - Area azul com gradiente sutil, contendo os campos basicos (Nome, Adquirente, Conta de Recebimento, Identificacao/Serial)
4. **Teclado/Area inferior** - Secao das taxas por parcelamento estilizada como "teclas" da maquininha, com cards individuais por plano de parcelamento
5. **Slot do cartao** - Detalhe decorativo no topo simulando a entrada do cartao

### Paleta de Cores

- Corpo: gradiente de `#1e3a5f` para `#2563eb` (azul escuro para azul eletrico)
- Display/tela: `#0f172a` com texto cyan/verde (estilo LCD)
- Botoes: azul mais claro com hover em cyan
- Bordas arredondadas generosas para simular o formato fisico

### Estrutura do Componente

```text
+------------------------------------------+
|  [====  Slot do Cartao  ====]            |
|                                          |
|  (LED)  NOME DA MAQUININHA               |
|         Adquirente                       |
|                                          |
|  +------------------------------------+  |
|  |  DISPLAY LCD                       |  |
|  |  D+ Debito: [1]   Taxa: [0.99%]   |  |
|  |  D+ Credito: [30]  Taxa: [3.29%]  |  |
|  +------------------------------------+  |
|                                          |
|  Conta: [Select____________]             |
|  Serial: [________________]              |
|                                          |
|  TAXAS POR PARCELAMENTO                  |
|  [2x 4.5%] [3x 5.2%] [+ Novo]          |
|                                          |
|  [Cancelar]          [Criar Maquininha]  |
+------------------------------------------+
```

### Detalhes de Implementacao

**Arquivo modificado:** `src/components/contas/TerminalFormModal.tsx`

- Manter toda a logica de estado e handlers existentes (sem mudanca funcional)
- Substituir apenas o JSX/layout dentro do DialogContent
- Usar classes Tailwind para o design skeuomorfico (gradientes, sombras internas, bordas arredondadas)
- Animacao sutil no LED (pulse) e transicoes nos inputs ao focar
- Display LCD com fonte monospacada e cor cyan
- Responsivo: em telas menores, o layout se adapta mantendo a estetica

### Elementos de Design

- **LED indicator**: Bolinha verde com animacao `animate-pulse` no header
- **Card slot**: Barra fina com gradiente no topo simulando entrada do cartao
- **Display**: `bg-slate-900` com `font-mono text-cyan-400` para efeito LCD
- **Corpo**: `bg-gradient-to-b from-blue-800 to-blue-600` com `rounded-2xl`
- **Inputs dentro do display**: Estilizados com fundo transparente e bordas cyan
- **Botoes de parcelamento**: Cards compactos com hover effect tipo "tecla"
- **Sombra interna**: `shadow-inner` no display para profundidade

### Arquivo modificado

- `src/components/contas/TerminalFormModal.tsx` (unico arquivo, apenas mudanca visual)

