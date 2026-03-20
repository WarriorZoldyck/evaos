


## Correção: Contexto de Conta e Parcelamento via WhatsApp (CONCLUÍDO)

Implementado cross-context account resolution e reforço de parcelamento no prompt.

## Aprimorar memória e inteligência da EVA no WhatsApp (CONCLUÍDO)

### Implementado:

1. **Memória expandida**: Janela de conversa de 3h/80msg → 30 dias/500msg, com resumo progressivo das mensagens mais antigas (últimas 30 integrais).

2. **Histórico de lançamentos**: Busca 100 transações dos últimos 90 dias e monta bloco de "Padrões Históricos" agrupados por contact_name/descrição, mostrando categoria usada, contexto e frequência. Injetado no prompt da IA.

3. **Reuso automático de categoria**: Antes de pedir criação de nova categoria, heurística compara contact_name e descrição do lançamento atual com histórico. Se encontrar match no mesmo contexto, reutiliza a categoria automaticamente. Log "CATEGORY REUSED FROM HISTORY" para rastreamento.

4. **Prompt reforçado**: Regra explícita de que estabelecimento ≠ categoria. IA instruída a priorizar histórico do usuário e nunca usar nome de estabelecimento como categoria.
