# Recategorizar a importação de 30–31/07 da conta simoespaula

## O que a auditoria mostrou

- Nenhum lançamento antigo dela foi apagado ou perdeu categoria: os 439 lançamentos anteriores a 25/07 continuam categorizados (412 com subcategoria detalhada).
- O que mudou foi a importação de 30–31/07: 182 lançamentos (período jan–mai/2026, contexto Pessoal) entraram com categorias genéricas de nível raiz gravadas como texto (GEOVANNA, LAZER, MORADIA, PESSOAL, VITORIA…) em vez das subcategorias que ela usa.
- Não existem duplicatas entre esses lançamentos e os antigos, e não há tabela de histórico/undo para transações — por isso a correção é recategorizar, não “reverter”.

## O que será feito

Correção pontual e exclusiva do usuário `simoespaula@gmail.com`, limitada aos lançamentos criados em 30–31/07/2026.

1. Para cada lançamento dessa importação, procurar no histórico dela (lançamentos anteriores a 25/07 com subcategoria) o mesmo fornecedor/contato ou descrição:
   - Correspondência exata de nome do contato/descrição (hoje cobre ~45 lançamentos).
   - Se não houver, correspondência aproximada por texto normalizado (sem acento, sem números/parcelas, sem maiúsculas) e por prefixo do estabelecimento.
   - Em empate, vence a subcategoria mais usada por ela naquele fornecedor.
2. Onde a subcategoria histórica pertencer à mesma árvore da categoria raiz atual do lançamento, aplicar a subcategoria; onde divergir de raiz, manter a raiz atual (evita mover o lançamento de grupo indevidamente).
3. Onde não houver histórico confiável, converter o texto da raiz para o **ID** da categoria raiz correspondente dela, para o lançamento deixar de depender de nome solto e passar a exibir/agrupar corretamente nos relatórios.
4. Antes de aplicar, gerar uma prévia (contagem por categoria de origem → destino) para conferência.

## Detalhes técnicos

- Migração SQL única, com `WHERE user_id = '0b1eb160-7199-4965-928e-e5f929b31c55' AND created_at >= '2026-07-30'` em todos os UPDATEs — nenhum outro usuário é tocado.
- Antes do UPDATE, criar a tabela de resguardo `public.backup_simoespaula_categorias_20260801` com `id` e `category` originais dos 182 lançamentos, permitindo desfazer a correção a qualquer momento.
- Sem grants públicos nessa tabela de resguardo (uso apenas por service role).
- Nenhuma mudança de código de aplicação; a origem do problema (importação gravando nome de raiz em texto) fica registrada como próximo passo separado, caso você queira que a importação passe a gravar ID de categoria.
