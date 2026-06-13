## Objetivo

Antes de publicar a DRE Contábil revisada, corrigir o bug histórico de roteamento de categorias e validar numericamente os totais contra dados de produção (`espclin@hotmail.com`).

## 1. Unificar lista de seções DRE (fonte única da verdade)

Criar `src/lib/dreSections.ts` exportando:
- `DRE_SECTIONS` (com `key`, `label`, `sign`, ordem visual da DRE escalonada)
- `VALID_SECTION_KEYS` (apenas as keys, usada pelo resolver em `useDREData`)
- `SECTION_LABEL` (lookup `key → label`)
- `resolveLegacyMdr(key)` que devolve `"despesas_vendas"` quando `key === "mdr"` (ver passo 2)

Refatorar para importar deste módulo:
- `src/hooks/useDREData.ts` — substituir `DreSectionKey` e `VALID_SECTION_KEYS` locais.
- `src/components/categorias/CategoryFormModal.tsx` — usa a lista para o dropdown.
- `src/pages/CentrosDeCustos.tsx` — usa a mesma lista, com o filtro do toggle MDR já existente.

Adicionar as duas novas seções no array compartilhado:
- `depreciacao_amortizacao` — "Depreciação e Amortização" (−)
- `tributos_sobre_lucro` — "IRPJ / CSLL" (−)

E manter `mdr` no array, com flag `legacy: true` para Centros de Custos continuar mostrando o bucket atrás do toggle.

## 2. Corrigir o bug do MDR (decisão: cai em Despesas com Vendas)

No `useDREData.ts`, dentro do resolver `resolveDreSection`:
- Se `dre_section === "mdr"`, normalizar para `"despesas_vendas"` antes da validação.
- Isso garante que toda categoria MDR (passada ou futura) entra em "Despesas com Vendas" no DRE, sem precisar migrar dados.

Adicionalmente, rodar migração retroativa de dados (`UPDATE categories SET dre_section='despesas_vendas' WHERE dre_section='mdr'`) com `supabase--insert`, para limpar o estado e permitir remover o `mdr` legado no futuro. Como o usuário quer continuar acompanhando MDR de forma separada, manter um campo auxiliar `is_mdr boolean` em `categories` para destacar essas categorias em dashboards específicos. **Decisão de implementação:**
- Hoje o "destaque MDR" será preservado via tag/badge na própria categoria — não vamos quebrar nada na UI atual de CC. Apenas o roteamento do DRE muda.
- Dashboard com card específico de "Taxas MDR" fica registrado como próximo passo (fora desta entrega).

## 3. Sincronizar Centros de Custos

Após o passo 1, `CentrosDeCustos.tsx` passa a exibir automaticamente as 2 novas seções (D&A e IRPJ/CSLL) como buckets de drag-and-drop, na ordem correta da DRE escalonada.

## 4. Pente fino numérico contra produção

Para o `espclin@hotmail.com` (user_id `b049592f-d97a-468d-a839-ed02c2a41d9b`), ano corrente (2026):

a) Conferir total de transações com `competence_date BETWEEN '2026-01-01' AND '2026-12-31'`, agrupado por `type` e `dre_section` (via JOIN em `categories`), excluindo transferências internas.

b) Comparar com:
- `Σ receitas` = Receita Operacional Bruta + Receitas Não Classificadas + Receitas Financeiras
- `Σ despesas` = Deduções + CMV + Desp. Vendas + Desp. Op + Desp. Gerais + Desp. Não Classif. + D&A + Desp. Financeiras + IRPJ/CSLL
- `Lucro Líquido esperado = Σ receitas − Σ despesas`

c) Identificar categorias em uso com `dre_section IS NULL` ou `dre_section='mdr'` e listar quantas transações caem em "Não Classificadas" — esse número deve cair para zero (ou ficar só com categorias realmente sem mapeamento) após o fix do MDR.

d) Reportar resultados antes de publicar. Se houver divergência, **não publicar** e investigar.

## 5. QA visual no preview

- Abrir a DRE Contábil com filtros padrão (ano atual, mensal, contábil).
- Conferir aparição das novas seções escalonadas e dos novos cards de indicadores.
- Ativar AV% e AH% e validar que as colunas/células aparecem corretamente.
- Validar que categorias antes em "Não Classificadas" por causa do MDR agora aparecem dentro de Despesas com Vendas.

## Notas técnicas

- A unificação em `src/lib/dreSections.ts` elimina o risco de novas dessincronizações futuras (qualquer nova seção entra automaticamente em todos os 3 pontos: cadastro, CC e DRE).
- Não há mudança de schema — `dre_section` continua texto livre.
- Migração de dados (`UPDATE` em `categories`) é idempotente e segura.

## Fora de escopo (próximos passos)

- Card dedicado "Taxas MDR" no Dashboard (separar visualmente do total de Despesas com Vendas).
- Remoção definitiva do toggle e do bucket MDR de Centros de Custos (após período de transição).
- Trigger de onboarding criando categorias padrão D&A e IRPJ/CSLL.
