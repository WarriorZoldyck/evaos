
Objetivo
- Fazer preço e tempo atualizarem o breakdown e os demais indicadores enquanto o usuário digita, sem depender de clicar fora.
- Corrigir a base dos cálculos para que CF, líquido e lucratividade batam.

O que encontrei
- `ProcedureTableV2` só envia a mudança no `onBlur`; por isso a visualização ao lado não acompanha a digitação.
- Os inputs usam `parseFloat` direto, sem tratar número em pt-BR. Isso pode truncar valores como `1,5` para `1`.
- `calcProcedure` usa `custoHora`, mas o módulo já expõe `custoHoraPorSala`; isso pode inflar o CF do procedimento quando existe mais de uma sala.
- A lógica de cálculo está espalhada em mais de um ponto, o que facilita divergência visual.

Plano
1. Edição realmente ao vivo
- Refatorar `LiveNumberInput` para input controlado com suporte a decimal pt-BR.
- Atualizar o estado local do procedimento a cada alteração válida.
- Manter a persistência no banco com debounce no hook.
- Fazer Enter confirmar imediatamente e blur virar apenas fallback.

2. Corrigir e centralizar a conta do procedimento
- Revisar `calcProcedure` para virar a única fonte de verdade.
- Alinhar o CF com a base correta do módulo, usando a lógica por sala já refletida no resumo.
- Manter explícita a fórmula:
  `Líquido = Preço - CF - CV - NF`
  `NF = Preço × alíquota`
  `Lucratividade/h = Líquido / tempo`

3. Sincronizar todos os pontos visuais
- Fazer tabela, breakdown, gráfico e demais blocos consumirem a mesma conta centralizada.
- Revisar nomes como `Líquido`, `Lucro` e `Lucr./h total` para evitar métricas duplicadas ou confusas.

4. Padronizar parsing numérico na V2
- Aplicar o mesmo parser pt-BR nos pontos críticos da precificação: tabela de procedimentos, modal e campos que afetam o cálculo.
- Remover dependência de `parseFloat` cru onde o usuário pode digitar vírgula.

Arquivos principais
- `src/hooks/usePricingV2.ts`
- `src/components/precificacao-v2/ProcedureTableV2.tsx`
- `src/components/precificacao-v2/ProcedureBreakdownV2.tsx`
- `src/components/precificacao-v2/ProcedureFormModalV2.tsx`
- `src/components/precificacao-v2/ProcedureComparisonChart.tsx`
- `src/pages/Precificacao.tsx`
- `src/pages/PrecificacaoV2.tsx`

Validação na implementação
- Digitar `1500` e ver tabela + breakdown atualizando sem clicar fora.
- Digitar `1,5` hora e confirmar que não vira `1`.
- Testar cenário com mais de uma sala para validar o CF.
- Confirmar que o vermelho só aparece quando o líquido realmente ficar negativo.
