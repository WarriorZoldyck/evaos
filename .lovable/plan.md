

## Plano: Corrigir itens de custo duplicados nos procedimentos

### Problema

Os custos variáveis do procedimento "Implante 1" estão duplicados no banco de dados. O breakdown mostra "Implante" e "Kit" repetidos 4 vezes cada, somando R$ 1.120 de CV quando deveria ser R$ 280 (1x Implante R$ 225 + 1x Kit R$ 55).

A causa provável é o fluxo de `updateProcedure` no hook `usePricingV2.ts`, que faz delete + insert dos itens sem proteção contra chamadas concorrentes. Se o usuário salva rápido ou há retry de rede, os itens se multiplicam.

### Mudanças

**1. Limpar dados duplicados no banco**
- Executar query para identificar e remover itens duplicados da tabela `pricing_v2_procedure_items`, mantendo apenas uma cópia de cada (description + value) por procedure_id

**2. Prevenir duplicação futura em `src/hooks/usePricingV2.ts`**
- Adicionar um guard (flag `isUpdating`) no `updateProcedure` para evitar chamadas concorrentes ao delete+insert
- Aguardar confirmação do delete antes de fazer o insert dos novos itens (já faz isso, mas sem proteção de concorrência)

### Arquivos afetados
- `src/hooks/usePricingV2.ts` — guard contra chamadas concorrentes
- Query SQL para limpar duplicatas existentes

