# Simulador dentro das "saídas / mês" + calculadora de parcelamento na Precificação

## 1. Simulador nasce do detalhamento das saídas
Hoje o simulador é um card fixo ao lado, com nome da meta e "quanto juntar". Passa a ser um fluxo natural:

- Ao expandir "Média de saídas / mês", cada categoria da lista vira interativa: clicar abre um slider de corte (0-100%) na própria linha, mostrando quanto sobra por mês com aquele corte.
- Conforme o usuário mexe nos sliders, aparece um rodapé fixo dentro do painel: "Economia simulada: R$ X / mês · R$ Y em 12 meses" e um botão "Criar meta com essa economia".
- Sem campos de nome/valor alvo no simulador. O valor alvo é derivado da economia (economia mensal x prazo padrão de 12 meses) e o usuário ajusta tudo no formulário de meta, que já abre pré-preenchido com aporte mensal, prazo e um nome sugerido editável.
- O card `SavingsSimulator` separado deixa de existir; a coluna esquerda volta a ocupar a largura antiga e o layout da página volta a duas colunas (visão do contexto + centro/painéis).
- A lógica de cálculo continua em `savingsSimulator.ts` (funções puras já testadas), só reaproveitada pelo novo componente.

## 2. Calculadora de parcelamento sai de Metas e vai para Precificação
- Remover a calculadora da coluna esquerda de Metas.
- Inserir na página de Precificação, como um bloco próprio abaixo da "Calculadora de Preço Sugerido", no mesmo padrão de Card das demais seções.
- Comportamento igual ao atual (valor líquido desejado, maquininha cadastrada ou taxa manual, tabela de 1x a Nx).

## Detalhes técnicos
- `src/components/metas/planejamento/FinancialOverview.tsx`: `CategoryList` de despesas ganha estado de cortes, sliders por linha e rodapé com o resumo/CTA; recebe `onCreateGoal` via prop.
- `src/pages/Metas.tsx`: remove `SavingsSimulator` e `InstallmentCalculator`, ajusta a grade para `[280px_minmax(0,1fr)]`, passa o handler de prefill para `FinancialOverview`.
- Excluir `src/components/metas/planejamento/SavingsSimulator.tsx`.
- Mover `InstallmentCalculator.tsx` para `src/components/precificacao-v2/` e renderizar em `src/pages/Precificacao.tsx` (e `PrecificacaoV2.tsx`, se aplicável) dentro de um `Card`.
- Sem mudanças de banco, hooks de dados ou lógica financeira.
