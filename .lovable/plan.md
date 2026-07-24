## Objetivo
Garantir — e provar — que a categorização na importação vem 100% do histórico real do próprio usuário no banco, sem IA e sem vazamento entre usuários.

## Resposta direta
Não posso prometer "100% categorizado". Posso prometer **100% assertivo quando existir histórico**: se a descrição (normalizada) já foi categorizada antes por aquele usuário, ela virá igual; se nunca foi, fica "Sem categoria" para ele ajustar (em vez de chutar). Isso é o comportamento correto — chutar é o que estava dando errado.

## O que já está garantido no código
- Consulta apenas `public.transactions` e `public.ai_pending_transactions` filtradas por `user_id = effectiveUserId` (RLS + filtro explícito). Nunca mistura usuários.
- IA de sugestão desligada. Só histórico.
- Amostras "Sem Categoria" / vazias são ignoradas para não poluir o voto.
- Hierarquia preservada (Categoria › Sub › Sub2), mesmo quando o nome histórico não está na árvore atual do contexto.
- Sem match → fica "Sem categoria" (nunca inventa).

## Como você vai ter certeza (plano de verificação)

### 1. Painel de auditoria dentro do próprio modal de importação
Adicionar, em cada linha sugerida, um pequeno "por quê?" clicável que abre um popover mostrando:
- A descrição original e a descrição normalizada usada na busca.
- A(s) transação(ões) do histórico que casaram: data, valor, descrição original, categoria completa.
- A camada que resolveu (match exato, prefixo do comerciante, token, etc.) e quantas amostras votaram.
- Link "abrir no sistema" para a transação histórica.

Assim, para qualquer linha, você vê exatamente qual lançamento do seu banco justificou a sugestão.

### 2. Contador de transparência no topo do passo de conciliação
Mostrar: "X de Y linhas casadas com seu histórico · Z sem histórico · 0 vindas de IA". Deixa explícito que nada saiu de IA.

### 3. Script de verificação de isolamento (uso interno, quando pedir)
Query pronta para rodar em qualquer usuário reclamante:
- Conta quantas descrições distintas do extrato importado têm match exato normalizado em `transactions`/`ai_pending_transactions` daquele `user_id`.
- Lista as que não têm — essas são legitimamente "Sem categoria".
- Confirma que nenhuma linha da sugestão referencia `user_id` diferente.

### 4. Teste guiado com o usuário atual (espclin@hotmail.com)
- Reimportar o mesmo extrato.
- Confirmar item a item usando o "por quê?": `DROGASIL` → Saúde › Farmácias, `L E M ESCOVA E BELEZA` → Beleza › Salão, `LE BOMBOM` → Vestuário › Roupas › Vitória.
- Qualquer divergência vira bug reproduzível com evidência no popover.

## Detalhes técnicos
- Estender `SuggestionSource` em `src/hooks/useCategorySuggestions.ts` para carregar `matchedSamples` (até 3): `{ description, payment_date, amount, categoryPath }` e `layer` ("exact" | "merchant" | "prefix" | "token").
- Novo componente `SuggestionWhyPopover` usado em `src/components/lancamentos/import/ReconcileStep.tsx` na coluna de categoria.
- Header do passo mostra os contadores derivados de `suggestions` + linhas totais.
- Nenhuma mudança em RLS, schema ou edge functions. Nenhuma chamada a IA. Somente leitura das duas tabelas já usadas hoje.

## Fora de escopo
- Reativar IA como fallback.
- Alterar políticas RLS ou criar tabelas.
- Migração de dados históricos.