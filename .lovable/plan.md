## Objetivo

Deixar a **barra de filtros de Lançamentos fixa no topo** enquanto a tabela rola, seguindo o padrão do Dashboard e as melhores práticas de UX para telas de listagem (Linear, Notion, Airtable): o usuário sempre enxerga e ajusta filtros sem precisar rolar de volta.

## Decisão de UX

Depois de olhar o padrão do app e do Dashboard:

- **Título + subtítulo ("Lançamentos / N lançamento(s)") e botões de ação (Exportar, Importar Extrato, Novo Lançamento) continuam no fluxo normal** e rolam junto com a página. São ações "one-shot" — usar sticky nelas só rouba altura útil na lista.
- **A linha de filtros (busca, Tudo/Entradas/Saídas, Todos/Conciliados/Sem conciliação, Recentes, Categorias, Contas, "Todos...") + a linha de período (Tudo/Hoje/Semana/Mês/Ano + navegação de mês) grudam juntas no topo**, logo abaixo do header global do app (que já é sticky em `top-0`).
- Quando "grudada", a barra ganha um fundo `glass-strong` + borda inferior sutil, igual ao header global, pra dar a leitura visual de "estou fixa aqui" e não ficar flutuando por cima do conteúdo.
- O botão **"Pagar Fatura"** (que aparece só quando filtro = cartão específico) sai do bloco de título e passa a viver dentro da barra sticky, à direita — assim continua acessível enquanto o usuário rola a fatura.
- No mobile, a barra continua fixa; os filtros já usam wrap horizontal (como está hoje), sem mudança de layout.

## Alteração técnica

Editar apenas `src/pages/Lancamentos.tsx`:

1. Reorganizar o retorno em três blocos:
   - **Bloco topo (rola)**: título + subtítulo + ações (Exportar / Importar / Novo Lançamento).
   - **Bloco sticky**: `<div className="sticky top-14 z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 glass-strong border-b border-border/60">` contendo `<TransactionFilters />` e o botão "Pagar Fatura" quando aplicável.
   - **Bloco de conteúdo**: Card com Tabs + TransactionTable (como hoje).

2. `top-14` casa com a altura do header global (`h-14` em `AppLayout.tsx`). `z-30` fica abaixo do header (`z-40`) e acima do conteúdo/Card.

3. Manter o padding lateral do container principal; a barra usa margem negativa + padding pra ocupar 100% da largura útil e a borda inferior estender de ponta a ponta.

## Fora de escopo

- Sem mudança nos filtros em si, no `TransactionFilters.tsx`, na tabela ou na lógica de dados.
- Sem alteração no header global do app.
- Sem mudar Análises EVA / outras páginas.
