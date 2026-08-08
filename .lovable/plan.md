# Precificação — quantidade por procedimento e custo unitário vs. por sessão

Do vídeo: hoje, para cobrar 1 faceta, 3 facetas ou 3 implantes, é preciso criar um procedimento diferente para cada quantidade. A mudança permite cadastrar o procedimento uma vez e informar a quantidade, multiplicando só os materiais que são por unidade.

## O que muda

### 1. Cada material passa a ter um tipo de cobrança
No cadastro de custos variáveis do procedimento, ao lado do valor, um seletor:
- **Por unidade** — multiplica pela quantidade (ex.: pino do implante, R$ 500)
- **Por sessão** — valor fixo, não multiplica (ex.: kit cirúrgico, R$ 60)

Padrão para itens novos e existentes: **Por sessão** (mantém o cálculo atual intacto).

### 2. Procedimento ganha campo "Quantidade"
Campo numérico (mínimo 1) ao lado de Tempo e Valor cobrado.

Custo variável passa a ser:
```text
CV = soma(itens por unidade × quantidade) + soma(itens por sessão)
```

Exemplo (implante, qtd 3): 3 × R$ 500 (pino) + R$ 60 (kit) = R$ 1.560.

Tempo de execução e valor cobrado continuam sendo digitados pelo usuário — não são multiplicados automaticamente, pois 3 implantes na mesma sessão não levam 3× o tempo (foi o exemplo dado no vídeo: "três implantes eu demoro duas horas").

### 3. Onde aparece
- **Modal de procedimento**: coluna de tipo em cada item + campo Quantidade; o preview de CF/CV/NF/Lucro já reflete a multiplicação em tempo real.
- **Tabela de procedimentos**: nova coluna "Qtd" editável inline (igual a Tempo e Preço), recalculando lucratividade na hora.
- **Detalhamento do procedimento**: cada material listado com "R$ 500 × 3 = R$ 1.500" quando for por unidade, e "R$ 60 (por sessão)" quando não for.
- Duplicar procedimento copia quantidade e tipos dos itens.

## Detalhes técnicos

Migração no banco:
- `pricing_v2_procedure_items`: nova coluna `unit_type text not null default 'sessao'` com CHECK em ('sessao','unitario').
- `pricing_v2_procedures`: nova coluna `quantity integer not null default 1` com CHECK `quantity >= 1`.
- Sem GRANT/RLS novos — as tabelas já existem e mantêm as políticas atuais.

Código:
- `src/hooks/usePricingV2.ts`: tipos `ProcedureV2Item.unit_type` e `ProcedureV2.quantity`; `calcProcedure` passa a aplicar a multiplicação no CV; create/update/duplicate/inlineUpdate persistem os novos campos.
- `src/components/precificacao-v2/ProcedureFormModalV2.tsx`: campo Quantidade, seletor por item e preview atualizado.
- `src/components/precificacao-v2/ProcedureTableV2.tsx`: coluna Qtd inline.
- `src/components/precificacao-v2/ProcedureBreakdownV2.tsx`: exibição do cálculo por item.
- Exportação (`ExportPricingButton`) inclui as novas colunas.

Procedimentos já cadastrados continuam com quantidade 1 e itens "por sessão" — nenhum valor existente muda.
