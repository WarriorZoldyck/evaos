## Diagnóstico do caso `espclin@hotmail.com` (VISA Azul)

### O que aconteceu na base

Fatura junho/2026 (`payment_date = 2026-06-09`) hoje tem **16 lançamentos / R$ 3.375,36**:

- **7 lançamentos antigos** criados manualmente em 19/06 (Empório MM, Frigorífico Goiás, Flores Paula, Gasolina, Decio L13, Campeão, Empório MM) — total **R$ 1.116,65**. Nenhum tem `purchase_date_original`.
- **9 lançamentos novos** criados pela importação em 08/07 03:17 (Disney+, Google ADS, ChatGPT, FACEBK, Jordana, Anuidade, Itaú Avisa, IOF, Redução Anuidade) — total líquido **R$ 2.258,71**. Todos com `purchase_date_original` entre 2026-05-01 e 2026-05-29.

Fatura maio/2026 (`payment_date = 2026-05-09`) tem 20 lançamentos, **todos `Pago`**, com `purchase_date_original = NULL` (foram entrados por WhatsApp/manual). Inclui itens como "Facebook / Google 3.454,54", "Chat GPT 118", "Nosso Mercadinho", "Barbearia", etc.

### Por que a conciliação não bateu

Três falhas somadas produziram o desalinho entre extrato (R$ ~3.608,27) e sistema (R$ 3.375,36):

1. **Matching não achou nenhum candidato existente**
   A query do `useImportMatching` filtra por `purchase_date_original BETWEEN min..max` (ou `competence_date` como fallback). Os 20 lançamentos da fatura maio estão como `Pago` com `purchase_date_original = NULL` e `competence_date` fora da janela do extrato (foram lançados via WhatsApp com competência ≠ compra). Resultado: todos os 9 lançamentos do extrato foram tratados como novos, mesmo quando a compra já existia no sistema em outro mês.

2. **Todas as 9 linhas foram jogadas na fatura errada**
   O importador atribui um único `payment_date` (2026-06-09) para o lote inteiro. Com `closing_day = 2`, compras de 2026-05-01 e 2026-05-02 (Google ADS, Anuidade, Itaú Avisa) pertencem à fatura **maio** (2026-05-09), não junho. Como a fatura maio já está `Pago`, essas compras acabaram inflando junho.

3. **Fatura junho carregava 7 lançamentos manuais anteriores**
   Esses 7 (Empório MM, Frigorífico Goiás, Flores Paula, Gasolina, Decio L13, Campeão, Empório MM) não aparecem no PDF importado. Eles continuam somando R$ 1.116,65 no total “Sistema”, mas nunca vão bater com nenhuma linha do extrato — são compras avulsas que ainda não têm correspondência no extrato ou são de ciclo diferente.

Resumo aritmético do gap:

```text
Sistema junho após import = 1.116,65 (7 manuais)
                          + 2.258,71 (9 importados)
                          = 3.375,36
Extrato PDF               = 3.608,27
Diferença                 = 232,91
```

O “bateu” do usuário nunca poderia acontecer porque:
- o sistema soma coisas que não estão no extrato (7 manuais de junho);
- o extrato tem linhas que não viraram lançamentos novos (algumas conciliaram ou foram puladas);
- lançamentos que **já existiam** em maio deveriam ter sido reconhecidos e não foram, por causa do filtro por `purchase_date_original`.

### Plano de correção

1. **Ampliar o escopo de candidatos do matching de cartão**
   - Quando `isCard`, incluir também transações do cartão com `purchase_date_original IS NULL` cuja `payment_date` esteja na fatura atual OU na anterior/próxima do mesmo cartão.
   - Aceitar candidatos `Pago` do mesmo cartão quando `payment_date` cai na fatura anterior imediatamente (evita duplicar quando o usuário importa a fatura recém-fechada e o lançamento já foi pago via WhatsApp).

2. **Roteirizar `payment_date` linha a linha, não por lote**
   - Para cada linha do extrato, calcular a fatura correta a partir de `purchase_date_original` + `closing_day`/`due_day` do cartão, em vez de aplicar um único `payment_date` ao lote inteiro.
   - Compras antes do fechamento vão para a fatura do mês; após o fechamento, para a fatura seguinte.

3. **Alertar sobre lançamentos “sobrando” no sistema**
   - Na etapa de conciliação, listar explicitamente os lançamentos do sistema que estão na fatura mas não têm correspondência no extrato (os 7 manuais de junho, no caso), com ação “ignorar / mover / excluir”.
   - Mostrar a diferença numérica quebrada em: “só no extrato”, “só no sistema”, “casados”.

4. **Melhorar dedupe por assinatura**
   - Fingerprint por `(cartão, valor, mês da compra, tokens da descrição)` para pegar casos onde `purchase_date_original` é nulo no candidato mas descrição/valor batem (ex.: “Chat GPT 118” manual vs “ΟΡΕΝΑΙ *CHATGPT 107”). Marcar como sugestão, não auto-linkar.

5. **Testes cobrindo o caso real**
   - Cenário: fatura maio `Pago` com 20 itens sem `purchase_date_original`; importar extrato equivalente não deve criar duplicatas em junho.
   - Cenário: extrato com compras cruzando fechamento (01–02/05 vão para maio; 03/05–02/06 vão para junho) — as linhas devem cair na fatura correta, não todas em junho.
   - Cenário: fatura destino com lançamentos manuais extras — total “Sistema” deve mostrar diferença clara e não “empatar” artificialmente.

### Resultado esperado

- Nenhum importado pula para a fatura errada quando a data de compra pertence a outra fatura do mesmo cartão.
- Compras já existentes (mesmo `Pago` e sem `purchase_date_original`) viram candidatos e não duplicam.
- Quando o extrato não fecha com o sistema, a UI mostra claramente o que sobra de cada lado, com R$ e contagem, em vez de exibir um total agregado enganoso.
