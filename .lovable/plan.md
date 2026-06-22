## Objetivo

Permitir que o usuário cadastre **conta bancária, cartão de crédito ou carteira** pelo WhatsApp da EVA, com confirmação em duas etapas, respeitando contexto (Pessoal/Empresa) e os limites do plano.

Quando estiver no ar, removemos a trava do fix (B) e a IA passa a executar de verdade o que hoje só fala em redirecionar para o app.

## Escopo

**Incluído**
- Criar `bank_account`, `credit_card` e `wallet` (não inclui maquininha — fluxo diferente, fica para depois).
- Coleta conversacional dos campos mínimos, com defaults sensatos.
- Confirmação obrigatória antes de gravar (igual ao padrão de lançamentos).
- Respeito a `usePlanLimits.canCreateAccount(kind)` — bloqueia se atingiu limite do plano.
- Respeito a contexto Pessoal (`company_id=null`) vs Empresa (`company_id=<uuid>`).
- Auditoria: registrar criação em `whatsapp_messages` (já existente) e via Hub audit log quando aplicável.

**Fora de escopo**
- Edição/exclusão de contas pelo WhatsApp.
- Cadastro de maquininha (precisa MDR, D+X, bandeiras — complexo).
- Cadastro de empresa, membro de hub, metas.

## Fluxo conversacional

```text
Usuário: "Quero cadastrar uma conta do Itaú no Pessoal"
EVA:     "Posso criar para você. Confirma os dados?
          • Tipo: Conta bancária
          • Nome: Itaú
          • Contexto: Pessoal
          • Saldo inicial: R$ 0,00
          Responda *sim* para confirmar ou me diga o que ajustar."
Usuário: "sim"
EVA:     "Pronto! Conta 'Itaú' criada no Pessoal. Pode lançar."
```

Se o usuário pedir cartão de crédito, a EVA também pergunta (em uma única mensagem) limite, dia de fechamento e dia de vencimento — todos opcionais com defaults (limite=0, fechamento=1, vencimento=10) que ele pode ajustar depois.

## Mudanças técnicas

### 1. Prompt (`supabase/functions/whatsapp-webhook/index.ts`)
- Remover/relaxar a trava do fix (B) **só para criar conta**.
- Adicionar novo intent `gerenciar_conta` com `action: "criar"` e payload:
  ```json
  {
    "intent": "gerenciar_conta",
    "action": "criar",
    "account_kind": "bank|card|wallet",
    "name": "...",
    "context": "Pessoal|<NomeEmpresa>",
    "initial_balance": 0,
    "credit_limit": null,
    "closing_day": null,
    "due_day": null,
    "friendly_message": "..."
  }
  ```
- Reforçar: NUNCA gravar sem passar pelo fluxo de confirmação (`whatsapp_pending_actions`).

### 2. Pending action (`whatsapp_pending_actions`)
- Novo `action_type: "create_account"`, TTL 10 min (padrão da tabela).
- Payload guarda o JSON completo retornado pela IA + `user_id` + `company_id` resolvido.
- Usuário responde "sim" → handler dispara o insert; "não" → descarta.

### 3. Handler (`whatsapp-webhook/index.ts`)
- Função nova `handleCreateAccount(payload, supabase, userId)`:
  1. Resolver `company_id` a partir do `context`.
  2. Checar limite do plano lendo `subscription_plans` + contagens atuais (replicar lógica de `usePlanLimits.canCreateAccount`). Se bloquear, devolver mensagem amigável de upgrade.
  3. Validar campos por `account_kind`:
     - `bank`: `name` obrigatório, `initial_balance` numérico.
     - `card`: `name`, `credit_limit`, `closing_day` 1-31, `due_day` 1-31.
     - `wallet`: `name`, `initial_balance`.
  4. Insert em `bank_accounts` / `credit_cards` / `wallets` com `user_id`, `company_id`, defaults.
  5. Responder confirmação e dica de próximo passo.
- Mesmas regras de RLS já existem nas tabelas (insert pelo service role via webhook, sem mudança de policy).

### 4. Resolução de contexto
- Se usuário disse "Pessoal" → `company_id = null`.
- Se mencionou nome/CNPJ de empresa → match exato em `companies` do user. Se ambíguo, IA pergunta primeiro (já é padrão do prompt).

### 5. Sem mudança de schema
Tabelas `bank_accounts`, `credit_cards`, `wallets` já existem. Nenhuma migração necessária. Nenhum GRANT novo.

### 6. Testes manuais (checklist)
- [ ] Criar conta bancária no Pessoal → aparece em /contas.
- [ ] Criar conta na empresa pelo nome → vai com `company_id` correto.
- [ ] Criar cartão com limite e fechamento/vencimento → aparece em /contas com 3D card.
- [ ] Criar carteira → aparece como VirtualWallet.
- [ ] Tentar criar quando plano lotado → mensagem de upgrade.
- [ ] Dizer "não" na confirmação → nada é gravado e pending é descartado.
- [ ] Lançar gasto logo depois → usa a conta recém-criada normalmente.

## Arquivos afetados

- `supabase/functions/whatsapp-webhook/index.ts` — prompt + intent + handler + pending action handling.
- (Opcional) `mem://whatsapp/account-creation` — novo memory descrevendo o fluxo.

Nenhuma mudança de frontend.

## Estimativa

Implementação + teste manual: ~1 sessão de trabalho focada. Sem dependências externas.
