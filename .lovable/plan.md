# Máscara de moeda no simulador + painéis abertos por padrão

## 1. Campo "Novo gasto alvo" com máscara BRL

O input `type="number"` quebra com casas decimais (vírgula/ponto, valores parciais). Trocar por um campo de texto com máscara de moeda brasileira:

- Digitação apenas de dígitos, formatada em tempo real como `1.234,56` (centavos a partir da direita).
- Prefixo `R$` visível dentro do campo.
- Aplica o corte/aumento a cada digitação válida (sem esperar o blur), limitado ao intervalo permitido (0 → média atual nas saídas; média atual → dobro nas entradas).
- Ao receber o valor de volta do slider, o campo é reformatado com a máscara.
- Mesmo comportamento no modo entradas ("Novo faturamento alvo").

## 2. Simuladores abertos por padrão

- A lista de categorias de entradas e de saídas passa a vir expandida ao abrir a página (em vez de ambas fechadas), permitindo dois blocos abertos ao mesmo tempo.
- O painel lateral do simulador abre automaticamente na maior categoria do bloco relevante, para o usuário já ver o simulador sem precisar clicar.

## 3. Remover o card de total abaixo da lista de categorias

- O rodapé "Economia total simulada / Ganho total simulado" com o botão "Limpar tudo", que fica logo abaixo da lista de categorias, é redundante com o painel lateral e será removido.

## 4. Card "Nenhum cofrinho ainda" mais compacto

- Reduzir padding, tamanho do ícone e do título; sugestões em linhas mais baixas, para o bloco não dominar a coluna central.

## Detalhes técnicos

- `src/components/metas/planejamento/FinancialOverview.tsx`: substituir o `<input type="number">` do `OverviewDetailPanel` por input texto com helpers `formatCurrencyMask`/`parseCurrencyMask` (centavos como inteiro); manter estado de rascunho sincronizado com `projected`; remover o bloco de rodapé de total das listas de categorias.
- `src/pages/Metas.tsx`: estado `expanded` vira conjunto de blocos abertos (padrão: entradas e saídas abertas) e seleção inicial automática da categoria de maior valor; ajustar o `EmptyState` para versão compacta.
