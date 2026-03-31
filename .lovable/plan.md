

# Correção da Resolução de Conta e Data no WhatsApp

## Problemas Identificados

### 1. Conta selecionada errada (BTG ao invés de Itaú)
O sistema tenta resolver a conta pelo nome retornado pela IA ou pelo nome do banco no documento. Se o match é impreciso (ex: IA diz "BTG" mas o comprovante mostra dados do Itaú), ele aceita mesmo assim. Quando há múltiplas contas e nenhum UUID exato, ele deveria **perguntar ao usuário** com a lista numerada, mas o fallback de name-matching pode selecionar a conta errada antes de chegar nessa etapa.

### 2. Data de pagamento errada (vencimento ao invés de hoje)
A IA retorna `payment_date` como a data de vencimento do boleto (02/04), mas o comprovante mostra que o pagamento foi feito **hoje**. Para comprovantes de pagamento (PIX, transferência, etc), a `payment_date` deveria ser a data do pagamento real (hoje), e a `competence_date` a data do documento/vencimento.

## Correções

### Arquivo: `supabase/functions/whatsapp-webhook/index.ts`

**Correção 1 — Account resolution mais rigoroso**
- Na resolução por nome (linhas ~2095-2111), tornar o match mais estrito: exigir que o nome da conta **comece** com o termo buscado ou que o termo buscado **seja exatamente** o nome do banco (não substring parcial)
- Se o match por nome não é de alta confiança (ex: nome com <5 chars, ou múltiplos matches), **não usar** e deixar cair no fluxo de "choose_account" que pergunta ao usuário
- Na resolução por `documentPartyExtraction` (linhas ~2154-2182), aplicar a mesma restrição: só aceitar se houver **exatamente 1 match** de alta confiança

**Correção 2 — Data de pagamento em comprovantes**
- Adicionar lógica no prompt do sistema para instruir a IA:
  - Se o documento é um **comprovante de pagamento** (PIX realizado, transferência feita, recibo de pagamento), a `payment_date` deve ser a data da operação (geralmente hoje)
  - A `competence_date` preserva a data do documento/vencimento
- Adicionar safeguard no código: se `hasMedia` e o `payment_method` indica um pagamento direto (PIX, transferência, dinheiro) e o status é "Pago", forçar `payment_date = today` se a IA retornou uma data futura

**Correção 3 — Prompt reforçado**
- Adicionar no system prompt uma regra clara:
  ```
  REGRA DE DATA EM COMPROVANTES:
  - Se o documento é um COMPROVANTE de pagamento já realizado (PIX, transferência, débito), 
    payment_date = data da operação mostrada no comprovante (ou hoje se não visível)
  - Se o documento é um BOLETO/FATURA com vencimento futuro, 
    payment_date = data de vencimento, status = "Pendente"
  - competence_date = data de competência/emissão/compra original
  ```

## Resumo de Mudanças

| Local | Mudança |
|-------|---------|
| System prompt (~linha 1441-1444) | Reforçar regra de conta: NUNCA selecionar aleatoriamente |
| System prompt (novo bloco) | Adicionar regra de data para comprovantes vs boletos |
| Account name resolution (~2095-2111) | Exigir match exato ou alta confiança; senão, ir para choose_account |
| Document party resolution (~2154-2182) | Mesmo: match estrito ou pular |
| Date logic (~2576-2577) | Safeguard: se comprovante de pagamento direto com status Pago, payment_date não pode ser futuro |

