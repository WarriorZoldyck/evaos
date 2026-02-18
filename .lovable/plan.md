
## Correção: Lançamentos Liquidados Desaparecem Após Edição

### Causa Raiz Identificada

Ao analisar o código do `TransactionFormModal.tsx`, encontrei dois problemas que causam a perda de dados durante a edição:

**Problema 1: `card_terminal_id` não é preservado no reset do formulário (linha 372-396)**
Quando o formulário é aberto para edição, o `form.reset()` define todos os campos do lançamento original, EXCETO `card_terminal_id`. O campo fica com o valor padrão `""`, que no submit vira `null`. Isso apaga a informação da maquininha e o cálculo MDR do lançamento.

**Problema 2: O update envia TODOS os campos, incluindo `status` e `type` que dependem de state assíncrono**
Na linha 514-516, o update envia todos os campos de `baseData`, incluindo:
- `type: activeTab` (linha 489) -- o `activeTab` é setado via `useEffect` (assíncrono). O valor default é `"despesa"`. Se houver qualquer re-render antes do efeito rodar, um lançamento de "receita" pode ser salvo como "despesa", sumindo da view se o usuário filtra por tipo.
- `status: data.status` -- vem do form cujo default é `"Pendente"`. O `form.reset()` corrige para `"Pago"`, mas em edge cases (React Strict Mode, re-renders rápidos), o default pode prevalecer. Um lançamento "Pago" viraria "Pendente" e sumiria da aba "Realizado".

**Problema 3: Campos de conta podem ser zerados**
Se o usuário alterar o "Contexto" (empresa) durante a edição, `handleContextChange` (linha 407-417) limpa `bank_account_id`, `wallet_id`, `credit_card_id` e `card_terminal_id`. Se havia um filtro por conta ativo na listagem, o lançamento perde a conta e sai do filtro.

---

### Correções Propostas

**Arquivo: `src/components/lancamentos/TransactionFormModal.tsx`**

1. **Incluir `card_terminal_id` no `form.reset()` durante edição** (linha 372-396) para que o campo seja preservado.

2. **Proteger `status` e `type` durante edição** -- Na submissão (linha 514-516), quando `isEditing`, forçar o uso de `editTransaction.type` e `editTransaction.status` ao invés de depender do `activeTab` e do valor do formulário. Isso elimina qualquer race condition:

```
if (isEditing) {
  const { user_id, company_id, ...updateData } = baseData;
  // Forçar type e status do lançamento original
  updateData.type = editTransaction.type;
  updateData.status = editTransaction.status;
  success = await onUpdate(editTransaction.id, updateData);
}
```

Nota: o campo `status` não possui controle visual no formulário de edição, então o usuário não tem como alterá-lo intencionalmente. Se no futuro quisermos permitir mudança de status na edição, adicionaremos um switch explícito.

3. **Bloquear mudança de contexto durante edição** -- Desabilitar o seletor de contexto (empresa) quando `isEditing` é true, ou pelo menos não limpar os campos de conta.

### Impacto
- Zero alteração no banco de dados
- Corrige a causa raiz da "perda" de lançamentos liquidados
- Preserva dados de MDR/maquininha que antes eram apagados silenciosamente
- Sem risco de quebrar funcionalidades existentes
