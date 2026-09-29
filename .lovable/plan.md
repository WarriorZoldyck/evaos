# Histórico como auditoria real

## Por que está vazio
A página Histórico lê uma tabela de registros que nunca foi criada no banco, e nada grava as ações. Por isso aparece sempre "Nenhuma movimentação".

## O que vai passar a aparecer
Cada linha mostra data/hora, quem fez, a ação, a descrição e o valor:
- Lançamento criado, editado ou excluído (manual, WhatsApp, importação, EVA)
- Pagamento feito / desfeito (status Pendente <-> Pago)
- Análise EVA criada, aprovada ou rejeitada
- Extrato importado (um evento por lote, com quantidade de linhas)
- Ações de membros do Hub aparecem com o nome de quem agiu

Filtros: busca por descrição, tipo de ação e período. Detalhe da edição mostra "antes -> depois" dos campos alterados.

## Detalhes técnicos
- Migração: tabela `transaction_audit_logs` (id, user_id dono, actor_id, entity: transaction|ai_pending|import, entity_id, action, old_data, new_data, source, created_at) + GRANT SELECT a authenticated, ALL a service_role, RLS: dono e membros ativos do Hub leem; sem INSERT pelo cliente.
- Triggers SECURITY DEFINER AFTER INSERT/UPDATE/DELETE em `transactions` e `ai_pending_transactions`; actor = `auth.uid()` ou `created_by_user_id`/dono quando vier de função do servidor. UPDATE de status vira ação "Pagamento"/"Pagamento desfeito"; mudança de status em ai_pending vira "Aprovada"/"Rejeitada".
- Importação: grava um evento "Extrato importado" no final do lote (edge-safe via função RPC `log_import_batch`), e suprime os N eventos de INSERT individuais agrupando-os pelo lote na tela.
- `Historico.tsx`: consulta paginada, badges por ação, filtros, diff expansível; retenção de 365 dias via limpeza agendada.
- Histórico só começa a partir da ativação (ações passadas não têm registro).
