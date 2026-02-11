

## Redesign da Maquininha - Moldura Realista Estilo Ton/Moderninha

### Conceito

Criar uma moldura CSS que simule o formato fisico real de uma maquininha de cartao, inspirada nos modelos Ton T2/T3 e Moderninha da imagem de referencia. O corpo tera formato retangular com cantos arredondados generosos, uma "tela" touchscreen destacada no topo, e um "teclado" numerico decorativo na parte inferior.

### Estrutura Visual

```text
         ___________________
        /                   \        <- Topo arredondado
       |  * LED              |
       |  +-----------------+|
       |  |                 ||       <- Tela/Display (conteudo principal)
       |  |  Nome, Taxas,   ||
       |  |  Conta, Serial  ||
       |  |  Parcelamento   ||
       |  |                 ||
       |  +-----------------+|
       |                     |
       |  [1] [2abc] [3def]  |       <- Teclado decorativo (visual only)
       |  [4ghi] [5jkl] [6] |
       |  [7] [8tuv] [9wxyz]|
       |  [*] [0   ] [#]    |
       |                     |
       |  [Cancelar] [OK >>] |       <- Botoes de acao
       |                     |
        \___________________/        <- Base arredondada
```

### Mudancas Principais vs. Versao Atual

1. **Moldura externa mais pronunciada**: Borda grossa com gradiente 3D, sombras laterais e `border-radius` grande para simular plastico moldado
2. **Tela embutida**: A area de conteudo (inputs, selects) fica dentro de uma "tela" com borda fina e cantos arredondados, simulando um display touchscreen
3. **Teclado decorativo**: Grid 3x4 de "teclas" puramente decorativas na parte inferior, dando o aspecto visual de maquininha real (nao interativas)
4. **Alto-relevo e profundidade**: Uso de multiplas camadas de sombra (`box-shadow`) e bordas para dar sensacao de volume/3D
5. **Conteudo visivel e agradavel**: Fundo da tela mais claro (nao preto puro), labels com bom contraste, inputs com fundo semi-transparente branco para legibilidade

### Paleta e Estetica

- **Corpo/moldura**: Azul EVA OS com gradiente de `#1a3a6c` para `#2563eb`, com borda interna mais clara para efeito de chanfro
- **Tela**: Fundo `#0c1829` com borda fina azul-clara, texto branco e labels em cyan claro
- **Teclas decorativas**: Botoes pequenos com `bg-white/10`, bordas sutis, texto branco/cinza
- **Slot do cartao**: Fenda horizontal no topo com sombra interna
- **LED**: Verde pulsante como indicador de "ligada"

### Visibilidade do Conteudo

- Labels com tamanho `text-xs` e cor `text-cyan-300` (bom contraste no fundo escuro)
- Inputs com fundo `bg-white/10` e texto branco, placeholder visivel
- Secoes claramente separadas dentro da tela
- Scroll interno apenas na area da tela, moldura fixa

### Detalhes Tecnicos

**Arquivo modificado:** `src/components/contas/TerminalFormModal.tsx`

- Logica de estado e handlers permanece identica
- JSX completamente reescrito com a nova estrutura:
  - Container externo com formato de maquininha (padding lateral grosso, bordas 3D)
  - Area da "tela" com scroll interno contendo todos os campos do formulario
  - Grid 3x4 de teclas decorativas abaixo da tela
  - Botoes Cancelar/Salvar estilizados como botoes fisicos da maquininha
- Tailwind CSS puro, sem dependencias extras
- Efeito 3D via multiplas camadas de `box-shadow` e `border` com cores graduais

