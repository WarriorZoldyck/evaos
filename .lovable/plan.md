

# Corrigir Leitura de Documentos no WhatsApp — Merchant Search Inteligente

## Problema Raiz

Quando a Paula (ou qualquer usuario) envia um comprovante de PIX, o sistema `extractDocumentParties` retorna:
- `issuer_name` = "Paula Regina Silva Simoes" (quem ENVIOU o PIX — ou seja, a propria usuario)
- `recipient_name` = "Edson Gleith de Oliveira" (quem RECEBEU o PIX — o verdadeiro destino)

O codigo usa `issuer_name` como `merchantSearchName` (linha 1832) e `docIssuer` (linha 1858) para buscar historico. Isso faz com que:
1. A busca historica encontre transacoes da propria Paula ("PIX recebido Paula...") que sao RECEITA
2. O `typeMatches` falha porque a transacao atual e DESPESA
3. Nenhuma categoria historica e reusada → pede para criar categoria nova

## Correcoes

### 1. Merchant Search inteligente baseado no tipo da transacao

No `merchantSearchName` (linha 1832), usar logica condicional:
- Se `txType === "despesa"` e o documento e um comprovante PIX/transferencia: usar `recipient_name` (quem recebeu = o fornecedor/destino)
- Se `txType === "receita"`: usar `issuer_name` (quem pagou = o cliente/pagador)
- Fallback: `aiParsed.contact_name || contactName`

### 2. `docIssuer` → `docMerchant` com mesma logica

Na linha 1858, substituir `docIssuer` por um `docMerchant` que seleciona o nome correto baseado no contexto:
- Despesa + comprovante PIX/transferencia → usa `recipient_name`
- Receita → usa `issuer_name`
- NF/boleto → manter `issuer_name` (quem emitiu/cobrou)

### 3. Filtro anti-self-match

Adicionar protecao para NUNCA usar o nome do proprio usuario como merchant search. Buscar o `full_name` do profile e, se o `merchantSearchName` normalizado for similar ao nome do usuario, pular e usar o outro campo.

### 4. Enriquecer `extractDocumentParties` com tipo de transacao

Adicionar ao JSON de retorno um campo `transaction_direction` ("sent" | "received" | "unknown") para que o sistema saiba se o dinheiro esta saindo ou entrando, independente da nomenclatura issuer/recipient.

### 5. Prompt de extracao de imagem mais robusto

Reforcar no system prompt principal que para comprovantes de PIX/transferencia:
- `contact_name` deve ser o DESTINATARIO do pagamento (quem recebeu o dinheiro), NAO quem enviou
- Se o usuario e o remetente, o `contact_name` e quem aparece como beneficiario/favorecido

## Arquivo afetado
- `supabase/functions/whatsapp-webhook/index.ts`

## Detalhes Tecnicos

```text
FLUXO ATUAL (BUGADO):
  PIX Comprovante → extractDocumentParties
    → issuer = "Paula" (remetente/pagadora)
    → recipient = "Edson" (beneficiario)
  merchantSearchName = issuer = "Paula" ← ERRADO
  Busca historica encontra "PIX recebido Paula" (RECEITA)
  typeMatches falha (despesa != receita)
  → Nao encontra categoria → pede criar

FLUXO CORRIGIDO:
  PIX Comprovante → extractDocumentParties
    → issuer = "Paula", recipient = "Edson"
    → transaction_direction = "sent"
  merchantSearchName = recipient = "Edson" ← CORRETO
  docMerchant = "Edson"
  Busca historica por "Edson" → encontra categoria correta
  → Reusa categoria com sucesso
```

