## Diagnóstico: por que o DRE parece "fantasioso"

Investiguei o código (`src/hooks/useDREData.ts`) e os dados no banco. O problema é real e tem causa clara:

**Como o DRE funciona hoje:**
1. Cada categoria tem um campo `dre_section` (o "centro de custo do DRE") que é definido manualmente na página **Centros de Custos** (arrastando categorias para Receita Operacional, CMV, Despesas Operacionais, etc.).
2. No `useDREData`, ao montar a DRE Contábil, para cada transação:
   - **Primeiro**, tenta usar o `dre_section` explícito da categoria-raiz.
   - **Se não houver**, cai num classificador por **palavras-chave** (`SECTION_KEYWORDS`) que tenta adivinhar pelo nome ("aluguel" → operacional, "iss" → imposto, etc.).
   - **Se nada casar**, joga em **"Despesas Gerais"** (despesa) ou **"Receita Operacional"** (receita).

**O que o banco mostra hoje:**
| dre_section            | nº de categorias |
|------------------------|------------------|
| *(NULL — não mapeado)* | **933**          |
| despesas_operacionais  | 20               |
| receita_financeira     | 19               |
| cmv_csp                | 9                |
| despesas_financeiras   | 4                |
| receita_operacional    | 1                |

Ou seja: **~95% das categorias não estão vinculadas a nenhum centro de custo**. O DRE está sendo montado quase 100% por adivinhação de keywords — por isso parece fantasioso. Toda receita sem keyword vira "Receita Operacional" e toda despesa sem keyword vira "Despesas Gerais", mesmo que conceitualmente sejam outra coisa.

**Resposta direta à pergunta:** sim, os centros de custos *deveriam* ser a fonte do DRE — e o código até tenta usá-los, mas como quase nenhuma categoria está mapeada, ele cai no fallback de keywords. Não é bug de cálculo; é falta de mapeamento + um fallback agressivo demais que mascara o problema.

---

## Plano de correção

### 1. Tornar o centro de custo a fonte ÚNICA de verdade no DRE
Em `src/hooks/useDREData.ts` (modo Contábil):
- Remover a classificação por keywords.
- Para cada transação, resolver o `dre_section` subindo a árvore de categorias (categoria → pai → avô) até achar um valor definido.
- Se nenhuma categoria da cadeia tiver `dre_section`, classificar em uma **nova seção "Não Classificado"** (separada para receitas e despesas), em vez de empurrar para Operacional/Gerais silenciosamente.

### 2. Tornar visível o que está fora do DRE
- Na DRE Contábil, exibir as seções "(+) Receitas Não Classificadas" e "(-) Despesas Não Classificadas" sempre que houver valores ali, com um aviso no topo: *"X categorias sem centro de custo. Classifique em Centros de Custos para refletir corretamente no DRE."* com link para `/centros-de-custos`.

### 3. Herança pai→filho na página Centros de Custos
Hoje só categorias-raiz aparecem na tela. Garantir que ao mapear uma raiz, **todas as filhas herdem** o `dre_section` automaticamente na hora de classificar transações (já contemplado no item 1 ao subir a árvore — não precisa migração de dados).

### 4. (Opcional, recomendado) Mapeamento assistido em lote
Botão "Sugerir mapeamento" na página Centros de Custos que roda o classificador-por-keywords atual **uma única vez**, mostra as sugestões e deixa o usuário aprovar/ajustar antes de gravar `dre_section` em massa. Isso preserva o conhecimento dos keywords sem deixá-los rodando "por baixo" toda vez que o DRE é montado.

### Escopo desta entrega
- Itens 1, 2 e 3 entram juntos (correção de comportamento e visibilidade).
- Item 4 fica como pergunta: implemento agora ou em passo seguinte?

### Arquivos a alterar
- `src/hooks/useDREData.ts` — reescrever classificação contábil (remover keywords, usar herança pai→filho, criar seções "Não Classificado").
- `src/components/relatorios/DRETableContabil.tsx` — renderizar as novas seções.
- `src/pages/DRE.tsx` — banner de alerta com contagem de categorias não mapeadas + link para Centros de Custos.

### O que **não** muda
- Estrutura do banco (nenhuma migration).
- Valores das transações.
- DRE Gerencial (continua agrupando por categoria pura, como hoje).
- Página Centros de Custos em si (a UI continua igual; só passa a ser de fato a fonte do DRE).
