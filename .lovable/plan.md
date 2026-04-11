

## Plano: Melhorias no layout e UX da Precificação V1

### 3 alterações

---

### 1. Setas (spinners) nos campos do simulador "E se?" e Calculadora de Preço Sugerido

Os inputs já são `type="number"`, e na rodada anterior aplicamos CSS global para mostrar spinners em todos os `input[type="number"]`. Isso já deveria estar funcionando. Porém, os inputs com classe `w-28 h-7` na Calculadora de Preço Sugerido podem estar escondendo os spinners por falta de espaço. Vou verificar e garantir que todos os inputs numéricos nesses dois componentes tenham tamanho adequado para exibir as setas.

**Arquivos**: `WhatIfSimulator.tsx`, `SuggestedPriceCalculator.tsx` — ajustar largura dos inputs inline se necessário.

---

### 2. Simulador "E se?" não aparece para todos os usuários

O problema está na linha 59 do `WhatIfSimulator.tsx`: `if (procedures.length === 0) return null;`. Quando o usuário não tem nenhum procedimento cadastrado, o simulador inteiro desaparece — incluindo os campos de simulação de Horas/Salas/Alíquota que são úteis independentemente.

**Solução**: Sempre mostrar o simulador. Quando não houver procedimentos, exibir os campos de simulação (Horas, Salas, Alíquota) e o Custo/Hora simulado, mas omitir apenas a tabela de impacto nos procedimentos (ou mostrar uma mensagem "Cadastre procedimentos para ver o impacto").

---

### 3. Layout: Procedimentos embaixo, valores ao lado

Atualmente a Calculadora de Preço Sugerido e o Simulador "E se?" ficam lado a lado numa grid 2 colunas. O usuário quer um layout que escale melhor com mais dados: **procedimentos em lista vertical (embaixo)** e **valores/detalhes ao lado**.

**Solução**: Reorganizar a seção de Procedimentos + Breakdown para usar um layout de 2 colunas:
- **Coluna esquerda**: Tabela de procedimentos (lista vertical)
- **Coluna direita**: Breakdown do procedimento selecionado

A Calculadora e o Simulador permanecem abaixo, lado a lado (já estão bons assim).

**Arquivo**: `Precificacao.tsx` — envolver a tabela de procedimentos e o breakdown em `grid grid-cols-1 lg:grid-cols-3` (2/3 tabela, 1/3 breakdown).

---

### Detalhes técnicos

- Nenhuma migração de banco
- Impacto apenas em 3 arquivos: `Precificacao.tsx`, `WhatIfSimulator.tsx`, `SuggestedPriceCalculator.tsx`

