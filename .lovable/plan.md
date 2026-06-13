# Diagnóstico: por que o DRE não reconhece categorias vinculadas a centros de custo

## O que encontrei nos dados reais (`espclin@hotmail.com`)

Cruzei as 1.543 transações com as 374 categorias e a hierarquia de `dre_section`. Resultado:

| Status no DRE | Transações | Valor (R$) |
|---|---|---|
| Mapeadas corretamente | 743 | 714.552,82 |
| **Sem `dre_section` em nenhum nó da cadeia** | **1.073** | **544.363,05** |
| Referência de categoria não encontrada (transferências/textos antigos) | 105 | 228.957,74 |

**O resolver (`useDREData.ts`) está correto.** O motivo real do "Não Classificadas" não é bug do DRE — é o estado dos dados, com 3 padrões claros:

### Causa 1 — Categorias duplicadas com mesmo nome, só uma mapeada
A base tem categorias homônimas e o usuário mapeou só uma delas no Centros de Custos. As transações ligadas pela outra UUID ficam órfãs.

Exemplos confirmados:
- **Honorários** existe 3x — 2 mapeadas em `receita_operacional`, **1 sem mapeamento com 64 tx / R$ 127.504,73**
- **Administrativos** vs **ADMINISTRATIVOS** (case diferente) — só uma versão tem mapeamento herdado; a outra root acumula R$ 37k+33k
- **Educação** existe 2x — uma root mapeada, outra (filha de "PESSOAIS") não
- **Implantes/Dentais/Laboratórios** — roots `cmv_csp` ok, mas as homônimas filhas de "DESPESAS CLÍNICA PF" não herdam nada

### Causa 2 — Roots realmente não mapeadas
Categorias pessoais como **Supérfulos, Lazer, Moradia, Bancárias, transporte, Saúde, Alimentação, Planejamento** simplesmente nunca foram arrastadas para nenhuma seção do DRE. São 30 roots sem `dre_section` na base.

### Causa 3 — Fallback por nome ambíguo no resolver
Quando `t.category` chega como texto (não-UUID), o resolver faz `categories.find(c => name === ref)` e retorna a **primeira** encontrada — pode cair numa homônima sem `dre_section` mesmo existindo uma irmã mapeada.

## O que mudar

### 1. Resolver mais inteligente (`src/hooks/useDREData.ts`)
No fallback por nome, em vez de pegar a primeira categoria, agrupar todas as homônimas, resolver `dre_section` para cada uma (subindo a cadeia) e preferir a que tiver mapeamento. Só retornar `null` se nenhuma das homônimas tiver seção em qualquer nível.

Não muda nada para transações com UUID válida — só corrige fallback de texto.

### 2. Painel de diagnóstico em Centros de Custos
Adicionar um card no topo da página `/centros-de-custos` mostrando:
- **Categorias duplicadas (mesmo nome, mapeamento divergente)** — lista com botão "Aplicar mesmo mapeamento" que copia o `dre_section` da versão mapeada para as homônimas.
- **Roots sem `dre_section`** — contagem + atalho de scroll para a área "Não classificadas" da página.
- **Transações órfãs** (referência de categoria inválida) — contagem por período.

Objetivo: o usuário vê imediatamente *quais* categorias precisam de atenção em vez de descobrir só pelo número grande do DRE.

### 3. Aviso no DRE — drill-down de "Não Classificadas"
Tornar a linha "Receitas/Despesas Não Classificadas" clicável para abrir um modal listando as categorias responsáveis (top N + valor), com link direto para o Centros de Custos. Hoje o usuário vê só o total agregado.

### 4. Validação ao criar categoria (`CategoryFormModal`)
Quando o nome digitado bater (case-insensitive) com outra categoria existente do mesmo contexto, exibir alerta inline: *"Já existe uma categoria com este nome — deseja unificar?"*. Previne novas duplicatas.

## Fora de escopo (perguntar depois)
- Migração automática para **deduplicar** as categorias homônimas existentes (precisa decisão do usuário, caso a caso).
- Wizard de re-mapeamento em massa pelo extrato.

## Como vou validar
Rodar novamente o cruzamento na base do `espclin@hotmail.com` após aplicar (1) e confirmar que:
- O fallback por nome resolve as homônimas onde existe ao menos uma versão mapeada.
- O card de diagnóstico exibe corretamente as ~5 duplicatas críticas detectadas acima.
- O drill-down de "Não Classificadas" lista as roots `Supérfulos`, `Lazer`, `Moradia`, etc.
