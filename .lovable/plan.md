
# Integração Itaú via Open Finance (multi-tenant)

Como você ainda não escolheu o agregador, o plano usa **Pluggy** como padrão (melhor cobertura Itaú no Brasil, doc em PT, widget pronto). Toda a arquitetura fica isolada atrás de uma camada chamada `bank-aggregator` — se depois você preferir Belvo/Klavi, troca-se só o adapter, sem mexer na UI nem no banco de dados.

## Escopo desta entrega

- Card "Itaú" no `/integracoes` deixa de ser "Em breve" e vira **Conectar**.
- Cliente abre o widget Pluggy → faz login no Itaú (PF ou PJ) → escolhe a conta.
- EVA cria/vincula uma `bank_account` no contexto atual (Pessoal ou Empresa).
- Sincronização de **extrato** (últimos 90 dias na 1ª carga, depois incremental) e **saldo** atual.
- Lançamentos importados caem como pendentes na **Conciliação Bancária** (mesmo fluxo do Asaas).
- Sync manual (botão) + cron diário automático.
- Reaproveita o card visual do Asaas: status, último sync, "Conciliar", "Outra conta", desconectar.

Fora de escopo: emissão de boletos, pagamentos, PIX out, cartão de crédito Itaú (fica para fase 2).

## O que você precisa providenciar

1. Criar conta em **pluggy.ai** (tem sandbox gratuito).
2. Em *Applications*, gerar **Client ID** e **Client Secret**.
3. Me passar quando eu pedir — vou abrir o formulário seguro de secrets (`PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET`).
4. Em produção, contratar o conector Itaú (Open Finance regulado tem custo por conexão ativa/mês — confirma na cotação deles).

Enquanto você não passa as keys, a integração já fica pronta no código mas o botão "Conectar" mostra um aviso amigável de "ainda não configurado".

## Arquitetura

```text
 Frontend (Integrações)
   └─ ItauConnectModal
        └─ Pluggy Connect Widget (SDK oficial @pluggyai/connect)
              └─ retorna itemId
                   ↓
 Edge Function: pluggy-connect-account
   • troca itemId por accounts da Pluggy
   • cria bank_account no contexto correto
   • salva pluggy_integrations(item_id, account_id, ...)
                   ↓
 Edge Function: pluggy-sync (manual + cron 6h)
   • lista transactions desde last_sync_at
   • insere em asaas_sync_items (renomeio p/ bank_sync_items) c/ provider='pluggy'
   • atualiza saldo, last_sync_at
                   ↓
 Conciliação Bancária (já existe) → match com transactions reais
```

## Mudanças no banco

Migration nova:

- Tabela `pluggy_integrations` (espelho de `asaas_integrations`):
  `id, user_id, company_id, bank_account_id, pluggy_item_id, pluggy_account_id, institution_name, last_sync_at, sync_status, last_error, encrypted_meta`. RLS por `user_id`.
- Generaliza `asaas_sync_items` → adiciona coluna `provider text default 'asaas'` (não quebra Asaas) e passa a aceitar `pluggy`. Conciliação lê os dois.
- View `bank_integrations_v` unificando Asaas + Pluggy para a tela de Integrações listar tudo junto no futuro.

## Edge Functions novas

| Função | JWT | O que faz |
|---|---|---|
| `pluggy-connect-token` | sim | Gera `connect_token` curto (15min) p/ o widget abrir. Server-side, segredos nunca vão ao browser. |
| `pluggy-connect-account` | sim | Recebe `itemId` + `bank_account_id` (existente) ou cria nova; persiste integração. |
| `pluggy-sync` | sim | Busca transações novas + saldo. Aceita `integration_id` opcional. |
| `pluggy-disconnect-account` | sim | Remove item na Pluggy + deleta integração. |
| `pluggy-webhook` | não | Recebe eventos `item/updated`, `item/error`, dispara sync. |
| Cron diário | — | Chama `pluggy-sync` para todos os itens ativos a cada 6h. |

Tudo segue o mesmo padrão dos arquivos `asaas-*` que já existem (CORS, validação JWT em código, Zod nos bodies).

## Mudanças no frontend

- `src/hooks/usePluggyIntegration.ts` — espelho do `useAsaasIntegration`.
- `src/components/integracoes/PluggyConnectModal.tsx` — embute `<PluggyConnect />` do SDK.
- `src/pages/Integracoes.tsx` — converte o card "Itaú" em ativo:
  - Se PLUGGY não configurado: tooltip "Configuração em andamento, fale com o suporte".
  - Se configurado: botão "Conectar Itaú" → abre widget filtrado para conector Itaú (`connectorIds=[201]`).
  - Após conectar: mesmo bloco visual do Asaas (último sync, Conciliar, Sync, Outra, Desconectar).
- Logo Itaú já existe (`logoItau`).

## Segurança

- Client ID/Secret só em edge functions (`Deno.env`).
- `connect_token` gerado server-side e expira em 15min.
- Webhook valida assinatura `x-pluggy-signature` (HMAC) — guardar `PLUGGY_WEBHOOK_SECRET`.
- RLS estrita em `pluggy_integrations` (só dono lê/escreve).
- Hub members herdam acesso via mesmas políticas já existentes (`is_hub_member_writer`).

## Riscos e o que NÃO quebra

- **Asaas continua funcionando idêntico** — nenhuma função Asaas é tocada; só adicionamos coluna `provider` com default seguro.
- **Conciliação Bancária** já é provider-agnóstica na UI; só precisa filtrar `provider in (asaas, pluggy)`.
- Limite Pluggy sandbox: 100 conexões grátis — suficiente para validar com você + alguns clientes piloto.
- Open Finance Itaú PJ pede que cada empresa autorize separadamente (até 12 meses, depois renova). Tratamos `item.status='LOGIN_MX_ERROR'` mostrando botão "Reconectar Itaú" no card.

## Ordem de implementação

1. Migration (`pluggy_integrations` + coluna `provider`) — você aprova.
2. Pedir as 3 secrets: `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET`, `PLUGGY_WEBHOOK_SECRET`.
3. Edge functions `pluggy-connect-token` + `pluggy-connect-account` + `pluggy-sync` + `pluggy-disconnect-account` + `pluggy-webhook`.
4. Hook `usePluggyIntegration` + modal + atualização do card no `/integracoes`.
5. Cron diário (`pg_cron` chamando `pluggy-sync`).
6. Teste com sandbox Itaú da Pluggy (eles fornecem credenciais fake).

Quer que eu comece pela migration? Se sim, no próximo passo eu já abro o formulário das secrets também.
