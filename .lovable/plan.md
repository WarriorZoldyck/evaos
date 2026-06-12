## Diagnóstico dos vídeos

Transcrevi os três áudios. Os **vídeos 19 e 23** são sobre o Dashboard (ajustes visuais, filtros de categoria, comportamento dos cards) e a tela de Cartões — não são DRE. Vou tratá-los em conversas separadas.

O **vídeo 18** é o do DRE. Resumindo a fala do usuário:

> "FGTS está na pasta *Despesa Operacional e Administrativa > Tributos* no Centros de Custos, mas no DRE ele aparece como *Deduções e Impostos sobre Vendas*. Ele não está puxando o que eu mapeei."

## Causa real (não é só falta de mapeamento)

Verifiquei o banco. O `dre_section` está cravado em **categorias filhas/netas**, e não na raiz. Exemplos reais:

```
ADMINISTRATIVOS              → dre_section = null   ← raiz (única editável na UI)
ADMINISTRATIVOS > Aluguel    → dre_section = despesas_operacionais
ADMINISTRATIVOS > Aluguel maquininha cartão → dre_section = cmv_csp
ADMINISTRATIVOS > Taxas > BOMBEIROS  → dre_section = despesas_operacionais
ADMINISTRATIVOS > Taxas > Tx cartão  → dre_section = cmv_csp
ADMINISTRATIVOS > Tributos > FGTS    → dre_section = despesas_operacionais (alguns)
Despesas clinicas > Salário > FGTS   → herda despesas_financeiras (errado!)
```

Dois problemas se somam:

1. **A página Centros de Custos só lista categorias-raiz.** Mapeamentos antigos (provavelmente vindos do classificador por keywords que removemos) ficaram gravados em níveis intermediários e o usuário **não consegue vê-los nem corrigi-los pela UI**.
2. **O resolvedor `resolveDreSection` no `useDREData` sobe a árvore do nível mais específico para o pai.** Como o filho tem `dre_section` cravado, ele "ganha" do que a raiz diz — exatamente o oposto da expectativa do usuário, que arrasta a raiz no Centros de Custos achando que todos os filhos seguem.

Por isso o FGTS (e outros) cai em seções que o usuário nunca configurou conscientemente.

## Plano de correção

### 1. Centros de Custos passa a mostrar a árvore inteira
- Em vez de listar só raízes, expandir cada raiz mostrando filhas/netas com seus `dre_section` atuais.
- Cada nó pode ser arrastado para um centro, ou marcado como "herdar do pai" (limpa o `dre_section`).
- Mostra um badge "⚠ herda diferente do pai" quando filho diverge da raiz, para o usuário identificar mapeamentos órfãos como esses.

### 2. Resolvedor inverte a prioridade: raiz primeiro, filhos só sobrescrevem se explícito
Hoje a ordem é: subcategoria2 → subcategoria → categoria, subindo até achar `dre_section`. Vamos mudar para:
- **Resolver a partir da raiz, descendo** até a categoria da transação.
- O `dre_section` do nó mais profundo só vence se for **diferente do herdado da raiz** (override explícito).
- Resultado: mover a raiz no Centros de Custos passa a refletir em todos os filhos imediatamente, exceto onde o usuário explicitamente sobrescreveu.

### 3. Botão "Limpar mapeamentos de filhos" por raiz
Na página Centros de Custos, ao lado de cada categoria-raiz, um botão que zera o `dre_section` de **todos os descendentes**, forçando herança pura. Resolve casos como o FGTS herdando `despesas_financeiras` por estar dentro de "Despesas clinicas > Salário".

### 4. Aviso global no DRE de divergências
O banner amarelo atual conta categorias não classificadas. Adicionar uma segunda linha: "X categorias filhas estão sobrescrevendo o centro de custo da raiz" com link para Centros de Custos filtrado por essas divergências.

## Arquivos a alterar
- `src/pages/CentrosDeCustos.tsx` — renderizar árvore inteira, badge de divergência, botão "limpar filhos".
- `src/hooks/useDREData.ts` — inverter `resolveDreSection` (raiz→folha) e expor contagem de divergências.
- `src/pages/DRE.tsx` — segunda linha no banner de aviso.

## O que **não** muda
- Nenhuma migration de dados (mapeamentos atuais permanecem; o usuário decide o que limpar via UI).
- Nenhuma mudança no DRE Gerencial.
- Nenhuma mudança em transações ou valores.

## Pergunta antes de implementar
Os vídeos 19 (Dashboard) e 23 (Cartões) ficam para depois, ou quer que eu já abra plano separado para eles também?
