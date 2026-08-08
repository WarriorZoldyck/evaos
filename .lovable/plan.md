# Precificação — simulador reverso (preço a partir da lucratividade)

Do vídeo: hoje o sistema só calcula "informo o preço → vejo a lucratividade". O pedido é o caminho inverso e as três variações do mesmo jogo, feitas rápido, sem recadastrar procedimento.

## O que muda

### 1. Painel "Simulador" no procedimento selecionado
Abaixo da tabela, junto da Decomposição, um painel com três perguntas (abas ou seletor de modo):

- **Quanto cobrar?** — informo Quantidade, Tempo e a **lucratividade desejada (%)** → o sistema devolve o **preço total** e o **preço por unidade**.
- **Quanto lucro tenho?** — informo Quantidade, Tempo e o **preço proposto pelo cliente** → devolve a **lucratividade %** e o lucro por hora (é o comportamento atual, mantido).
- **Posso fazer por X?** — informo o preço-alvo e a **lucratividade mínima aceita** → resposta direta "Sim / Não", com o preço mínimo viável ao lado.

Todos os campos recalculam ao digitar, sem salvar nada — é simulação. Um botão "Aplicar ao procedimento" grava o preço encontrado no procedimento (o mesmo caminho do inline update já existente).

### 2. Preço por unidade em toda parte
Hoje só existe valor total. Passa a aparecer, sempre que a quantidade for maior que 1:

- Nova coluna **Preço/un.** na tabela de procedimentos (calculada, não editável).
- Linha "Preço por unidade" na Decomposição, junto do Valor Cobrado.
- No simulador, resultado sempre em par: total e por unidade (ex.: 10 lentes, R$ 5.000 total → R$ 500 cada).

### 3. Ajuste de quantidade e tempo recalcula tudo na hora
Já funciona na tabela; passa a valer também dentro do simulador: mudei de 2 para 10 lentes e de 2,5h para 8h, o custo fixo e os materiais por unidade se ajustam e o preço sugerido aparece imediatamente. Materiais por sessão continuam sem multiplicar.

### 4. Calculadora de preço sugerido existente
A calculadora genérica atual (tempo + margem, sem vínculo com procedimento) passa a permitir escolher um procedimento cadastrado como base, herdando quantidade, tempo e materiais. Fica sendo o mesmo motor do simulador, evitando dois cálculos diferentes na tela.

## Detalhes técnicos

Sem migração de banco — quantidade e `unit_type` já existem.

Fórmula inversa, coerente com `calcProcedure`:

```text
CF = custoHoraPorSala × tempo
CV = soma(unitário × qtd) + soma(por sessão)
preço = (CF + CV) / (1 − margem% − aliquota%)
preço_unitario = preço / qtd
```

Quando `margem% + aliquota% >= 100`, exibir aviso de cenário impossível em vez de número.

Código:
- `src/hooks/usePricingV2.ts`: expor `calcProcedureParts({ tempo, qtd, itens })` e `suggestPrice(parts, margemAlvo)` reutilizáveis; `calcProcedure` passa a usá-los.
- Novo `src/components/precificacao-v2/ProcedureSimulator.tsx`: os três modos, resultados em total e por unidade, botão de aplicar.
- `src/components/precificacao-v2/ProcedureTableV2.tsx`: coluna Preço/un.
- `src/components/precificacao-v2/ProcedureBreakdownV2.tsx`: linha de preço por unidade.
- `src/components/precificacao-v2/SuggestedPriceCalculator.tsx`: seletor de procedimento base, usando o mesmo motor.
- `src/pages/PrecificacaoV2.tsx`: renderiza o simulador ao lado da decomposição do procedimento selecionado.

Nenhum valor já cadastrado muda; a simulação só grava quando o usuário clicar em aplicar.
