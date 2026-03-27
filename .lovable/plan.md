

# Validação de Dígitos do Cartão na Imagem vs Escolha da IA

## Problema Real

O cross-context funciona, mas **nunca dispara** neste caso. A IA retorna o UUID do cartão "VISA Azul" (final 3552, Pessoal), que existe no contexto Pessoal. O match acontece na linha 1780 imediatamente. Porém, a imagem mostra um comprovante do cartão Itaú PJ (final 7993).

O problema: a IA faz uma escolha errada de cartão, e o sistema aceita sem questionar, porque o cartão escolhido existe.

## Solução

Após o match inicial do cartão (linha 1890+), adicionar uma **validação por dígitos visíveis**: a IA já extrai informações da imagem, então podemos instruí-la a retornar os últimos 4 dígitos visíveis no comprovante. Se os dígitos retornados pela IA não batem com o cartão que ela mesma escolheu, corrigir buscando o cartão correto em TODOS os cartões.

### Mudanças em `supabase/functions/whatsapp-webhook/index.ts`

**1. Prompt da IA** — Adicionar campo `visible_card_digits` no schema de retorno, instruindo a IA a extrair os últimos 4 dígitos visíveis no comprovante/imagem.

**2. Pós-match de cartão** — Após a linha 1890 (quando `cardMatch` foi encontrado), verificar:
```
Se aiParsed.visible_card_digits existe E é diferente de cardMatch.last_four_digits:
  → Buscar em TODOS os creditCards por last_four_digits === visible_card_digits
  → Se encontrar exatamente 1 match, substituir cardMatch
  → Se o novo match tem company_id diferente, fazer cross-context (re-filtrar tudo)
  → Logar: "Card digit mismatch corrected: AI chose X but image shows Y"
```

**3. Fallback da caption/mensagem** — Também extrair dígitos da caption do usuário (ex: "cartão final 7993") e aplicar a mesma lógica.

## Impacto

- Resolve o caso onde a IA escolhe o cartão certo pelo tipo mas erra na empresa
- Não quebra nenhum fluxo existente (é apenas uma validação extra pós-match)
- Custo zero — os dígitos já estão na imagem, só precisam ser extraídos

## Arquivo afetado

| Arquivo | Acao |
|---------|------|
| `supabase/functions/whatsapp-webhook/index.ts` | Adicionar `visible_card_digits` ao prompt + validação pós-match |

