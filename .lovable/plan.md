# Diagnóstico: divergência Dashboard × Lançamentos da Sabrina

## Resposta direta
**Não é erro do sistema** — os números do dashboard estão certos. A diferença é exatamente **R$ 3.379,99** de um lado e outro, e corresponde a **uma transferência interna entre as contas dela própria**.

## O que aconteceu

Na conta da `sabrinadomingues04@gmail.com` (status Pago):

| Origem        | Entradas    | Saídas      |
|---------------|-------------|-------------|
| Lançamentos (tudo) | R$ 11.230,00 | R$ 11.939,34 |
| Dashboard / DRE    | R$ 7.850,01  | R$ 8.559,35  |
| **Diferença**      | **R$ 3.379,99** | **R$ 3.379,99** |

A transferência identificada no banco:

```text
2026-06-05  PIX RECEBIDO  SABRINA RODRIGUES DOMINGU
  → débito de R$ 3.379,99 na conta A (1613aa1d…)
  → crédito de R$ 3.379,99 na conta B (9a18725…)
  transfer_id: 168f4e12-…  is_internal_transfer: true
```

Esse par está marcado como **transferência interna** (mesmo dono, dinheiro saindo de uma conta dela e entrando em outra). Pela regra do sistema (memória `features/internal-transfers`), transferências internas são **excluídas do Dashboard e do DRE**, porque não representam receita nem despesa reais — é só dinheiro mudando de bolso. Já a tela de Lançamentos lista tudo (inclusive transferências), por isso ela vê "entradas e saídas corretas" lá.

## Conclusão para a usuária
O cálculo está coerente:
- Lançamentos = visão bruta (todo movimento financeiro).
- Dashboard = visão econômica (exclui dinheiro entre contas próprias).

Não há nada a corrigir nos dados dela. A "diferença" é o comportamento esperado.

## Proposta (opcional, evita esse tipo de dúvida no futuro)

A confusão se repete com vários usuários. Para resolver de vez, sugiro um pequeno ajuste de UX no `Dashboard.tsx` — sem mudar nenhuma regra de negócio:

1. **Indicador discreto nos cards de Entradas e Saídas**: quando houver transferências internas no período filtrado, mostrar um rodapé pequeno no card no formato:
   ```text
   ⓘ R$ 3.379,99 em transferências entre contas próprias foram excluídas
   ```
2. **Tooltip explicativo** no ícone (ⓘ) com o texto:
   > "Transferências entre contas próprias não contam como receita nem despesa, por isso ficam de fora do dashboard e do DRE. Você ainda consegue vê-las na tela de Lançamentos."

### Implementação técnica
- Em `src/hooks/useDashboardData.ts`, computar `internalTransfersTotal` somando linhas com `is_internal_transfer = true` (ou `transfer_id IS NOT NULL`) e `status = 'Pago'` no período filtrado, e devolver no `summary`.
- Em `src/components/dashboard/HeroSummaryCards.tsx`, renderizar o aviso quando `internalTransfersTotal > 0`.
- Sem migração e sem mudança em edge function.

## Devolutiva para a Sabrina
Quer que eu mande a explicação a ela pelo WhatsApp da Eva (mesmo padrão usado para a Sabrina anterior e para o Renato), confirmando que está tudo certo e indicando a transferência específica?
