

## Estrategia: Aumentar para 1000 + Busca Inteligente por Relevancia

### Problema atual
O limite de 500 transações dos últimos 90 dias ainda pode não capturar lançamentos relevantes de usuários com alto volume (como o Renato, com 889 transações). Simplesmente aumentar para 1000 resolve o caso dele, mas outros usuários power-users podem ultrapassar novamente.

### Solucao em 2 camadas

#### Camada 1: Aumentar limite para 1000 (simples)
- Linha 1027: trocar `.limit(500)` por `.limit(1000)`
- Manter os 90 dias como janela

#### Camada 2: Busca direcionada por estabelecimento (evita o problema para sempre)
Alem da busca genérica de 1000 transações, fazer uma **segunda query focada**: quando houver `issuer_name` do documento ou `contact_name` da IA, buscar especificamente transações que contenham esse nome na `description` ou `contact_name`, sem limite de tempo (últimos 365 dias). Limite de 20 resultados. Isso garante que mesmo que o Moscato esteja na posição 1500, ele será encontrado.

```text
Query 1: últimas 1000 transações (90 dias) → padrões gerais
Query 2: busca focada por nome do estabelecimento (365 dias, limit 20) → matching garantido
```

Merge das duas queries eliminando duplicatas antes de rodar a heurística.

### Mudanças no arquivo

`supabase/functions/whatsapp-webhook/index.ts`:

1. **Linha 1027**: aumentar limit de 500 para 1000
2. **Após linha 1038**: adicionar busca direcionada — se `documentPartyExtraction?.issuer_name` existir, fazer query extra filtrando por `description.ilike.%nome%` ou `contact_name.ilike.%nome%` nos últimos 365 dias, limit 20
3. **Antes do loop de matching (~linha 1792)**: mergear os resultados das duas queries, deduplicando por `id`

### Impacto em performance
- Query 1 (1000 rows): ~50-100ms, aceitável
- Query 2 (targeted, limit 20): ~10-20ms, muito rápido por ser filtrada
- Sem risco de travar — ambas têm limite hard

### Resultado
- Renato com 889 transações: coberto pela query de 1000
- Usuário futuro com 2000 transações: a query focada encontra o estabelecimento mesmo fora das 1000

