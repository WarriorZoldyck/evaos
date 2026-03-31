

# Resolução de Conta por Agência e Número da Conta

## Problema
O sistema hoje tenta resolver a conta apenas pelo **nome** (ex: "Itaú", "BTG"). Mas os comprovantes de PIX/transferência mostram claramente o número da agência e conta. O sistema não extrai esses dados do comprovante e não os compara com os dados cadastrados nas contas do usuário.

## Causa Raiz
1. **`extractDocumentParties`** não pede agência/conta no JSON de retorno
2. **Query de `bank_accounts`** não busca `agency_number` nem `account_number`
3. **Lógica de resolução** não compara esses campos

## Correções

### 1. Atualizar o prompt de `extractDocumentParties` (linha ~229-244)
Adicionar ao JSON de retorno:
- `issuer_agency` — agência do remetente (se visível)
- `issuer_account` — número da conta do remetente (se visível)
- `recipient_agency` — agência do destinatário (se visível)
- `recipient_account` — número da conta do destinatário (se visível)
- `issuer_bank_name` — nome do banco do remetente (ex: "Itaú", "Nubank")
- `recipient_bank_name` — nome do banco do destinatário

### 2. Incluir `agency_number` e `account_number` nas queries de `bank_accounts`
Nas 3 queries (linhas ~726, ~984, ~1204), adicionar esses campos ao `select`.

### 3. Nova lógica de resolução por agência/conta (após linha ~2200)
Antes de cair no `choose_account`, tentar:
1. Extrair agência e conta do `documentPartyExtraction`
2. Comparar com `contextAccounts` que tenham `agency_number` e/ou `account_number` preenchidos
3. Se houver **exatamente 1 match**, usar essa conta
4. Se houver 0 ou múltiplos matches, continuar para o fluxo normal (perguntar ao usuário)

A comparação deve normalizar os números (remover pontos, traços, zeros à esquerda) para garantir match correto.

### 4. Ordem de prioridade na resolução
```text
1. UUID exato retornado pela IA
2. Match por agência + conta (novo)
3. Match por nome do banco (existente, já estrito)
4. Match por document party name (existente, já estrito)
5. Conta única no contexto → usa automaticamente
6. Múltiplas contas → pergunta ao usuário (lista numerada)
```

## Arquivo Afetado
| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/whatsapp-webhook/index.ts` | Prompt do extractDocumentParties, queries de bank_accounts, nova lógica de match por ag/conta |

