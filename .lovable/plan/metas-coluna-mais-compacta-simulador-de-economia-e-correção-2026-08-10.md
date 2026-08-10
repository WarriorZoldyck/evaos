# Metas: coluna mais compacta, simulador de economia e correção do plano da EVA

## 1. Cards da esquerda mais estreitos
- Reduzir a coluna esquerda de 340px para ~260px e compactar os cards de métrica (padding menor, valor em texto menor) para abrir espaço na grade.
- A grade passa a ter uma faixa extra ao lado dos cards, ocupada pelo novo simulador.

## 2. Simulador de meta ("calculadora de economia")
Novo card ao lado dos cards de contexto, visível também quando o usuário ainda não tem cofrinho:
- Campo "Quanto quero juntar" e "Em quantos meses" (ou data alvo).
- Lista das categorias de saída do ano (mesma fonte já usada no expandir "Média de saídas / mês"), cada uma com um slider/percentual de corte.
- Cálculo ao vivo: economia mensal simulada, quanto falta para o aporte necessário, e sinalização verde/vermelha se o plano fecha.
- Botão "Criar meta com esse plano" que abre o formulário de meta já pré-preenchido com valor alvo, prazo e aporte mensal simulado.
- Toda a matemática em função pura em `src/lib/goalPlanning.ts` (ou arquivo irmão) com testes; o componente só renderiza.

## 3. Corrigir o diálogo "Plano de ação da EVA"
Problemas atuais: conteúdo cresce sem limite, o rodapé sai da área visível e o botão fica inacessível.
- Dar altura máxima ao diálogo (`max-h-[85vh]`), com o corpo rolável e cabeçalho/rodapé fixos.
- Rodapé sempre visível, botões em largura total no mobile.
- Ajustar a tipografia do texto da EVA (espaçamento entre parágrafos, listas e negritos) para não ficar "quebrado".
- Revisar o estado do botão de ação: garantir que fique habilitado e que o clique dispare a chamada; exibir estado de carregamento e mensagem de erro visível dentro do diálogo em vez de só toast.

## Detalhes técnicos
- Arquivos: `src/pages/Metas.tsx` (grade e prefill), `src/components/metas/planejamento/FinancialOverview.tsx` e `FinancialMetricCard.tsx` (densidade), novo `src/components/metas/planejamento/SavingsSimulator.tsx`, `src/components/metas/ActionPlanDialog.tsx` (layout/rodapé), lógica pura + teste em `src/lib`.
- Sem alterações de banco nem fora da área de Metas.
