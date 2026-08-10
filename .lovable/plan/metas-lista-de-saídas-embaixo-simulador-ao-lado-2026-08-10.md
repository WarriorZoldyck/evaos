# Metas: lista de saídas embaixo, simulador ao lado

## Comportamento desejado

1. Clicar em "Média de saídas / mês" volta a expandir **abaixo do card**, na própria coluna esquerda, mostrando a lista de categorias com o valor médio mensal original (mesmo comportamento visual das entradas).
2. Clicar em **uma categoria** dessa lista abre, **ao lado** (painel central), o **Simulador de economia daquela categoria apenas**.
3. No simulador o usuário reduz a partir do valor original mostrado (slider de % e/ou valor), vendo quanto sobra e quanto economiza por mês e em 12 meses, com o botão "Criar meta com essa economia" já pré-preenchido.
4. Fechar o simulador não fecha a lista; trocar de categoria troca o conteúdo do painel.

```text
[ Saldo total        ]
[ Entradas / mês  v  ]      [ Simulador de economia ]
[ Saídas / mês    ^  ]      [ Alimentação           ]
   Alimentação  7.2k        [ original R$ 7.240     ]
   Clínica PF   1.1k        [ corte ---o--- 20%     ]
   Transporte    600        [ economiza R$ 1.448/mês]
[ Capacidade mensal  ]      [ Criar meta            ]
```

## Mudanças técnicas

- `FinancialOverview.tsx`
  - Voltar a renderizar a lista de categorias inline logo abaixo do card correspondente (entradas e saídas), usando `CategoryList` com os valores mensais atuais (sem divisão extra).
  - Nas saídas, cada linha vira botão que emite `onSelectCategory(name)`; a linha selecionada fica destacada e mostra o corte aplicado.
  - `OverviewDetailPanel` passa a receber uma única categoria (`{ name, monthlyAvg }`) mais o percentual atual e handlers, renderizando só o simulador daquela categoria (slider 0–100% + campo de valor alvo), resumo de economia mensal/12 meses e ação de criar meta.
  - Estado dos cortes (`Record<name, percent>`) sobe para `Metas.tsx` ou fica no `FinancialOverview` e é passado ao painel, para que os cortes persistam ao trocar de categoria e o total simulado some todas as categorias ajustadas.
  - Remover a lista com sliders dentro do painel lateral (`SavingsPanel` atual).
- `Metas.tsx`
  - Grid volta a duas colunas quando não há categoria selecionada; abre a terceira coluna (painel) só quando `selectedCategory` existir.
  - `OverviewDetailPanel` renderizado ao lado, alinhado ao topo.
- `savingsSimulator.ts` continua sendo a fonte de cálculo (`monthsInPeriod: 1`), sem alteração de assinatura; testes existentes seguem válidos.
- Sem alterações fora da área de Metas.
