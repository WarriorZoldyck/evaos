

## Problema: Lançamentos não podem ser editados adequadamente

### Diagnóstico

Ao editar um lançamento, o formulário bloqueia 3 coisas intencionalmente:

1. **Contexto (empresa) bloqueado** — Linha 478: `if (isEditing) return;` impede qualquer mudança de contexto
2. **Tipo (receita/despesa) bloqueado** — Linha 902: `{!isEditing && (TabsList)}` esconde as tabs, e linha 603: `updateData.type = editTransaction.type` força o tipo original
3. **Status bloqueado** — Linha 604: `updateData.status = editTransaction.status` força o status original

A intenção original era evitar "race conditions" e desaparecimentos de transações. Mas isso impede correções legítimas — especialmente para lançamentos criados pela EVA com dados errados.

### Solução proposta

Manter proteções mas permitir edições com confirmação:

#### 1. Permitir troca de contexto na edição
- Remover o `if (isEditing) return;` da linha 478
- Ao trocar contexto na edição, mostrar um aviso ("As contas serão redefinidas") e limpar as seleções de conta/cartão/carteira como já faz no modo criação

#### 2. Permitir troca de tipo (receita/despesa) na edição
- Mostrar as tabs mesmo em modo edição, mas sem a tab "Transferência"
- Remover a linha 603 que força `editTransaction.type`

#### 3. Permitir troca de status na edição
- Adicionar um campo Select para status ("Pago" / "Pendente") no formulário de edição
- Remover a linha 604 que força `editTransaction.status`

### Mudanças técnicas

**Arquivo**: `src/components/lancamentos/TransactionFormModal.tsx`

1. **Linha 478**: Remover o `if (isEditing) return;` — adicionar lógica para limpar contas ao trocar contexto em edição
2. **Linha 601**: Parar de descartar `company_id` no update — incluir o `company_id` do contexto atual (formCompanyId)
3. **Linhas 602-604**: Remover as 2 linhas que forçam type e status do original
4. **Linha 902**: Mostrar tabs de tipo (receita/despesa) em edição — esconder apenas "transferência"
5. **Adicionar campo de status** no formulário (Select com "Pago"/"Pendente"), visível apenas em edição

