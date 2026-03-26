

# Duas Melhorias: Transferência na Edição + Entendimento da Duplicação

## 1. Permitir "Transferência entre Contas" ao Editar

### Problema
Quando o usuário edita um lançamento, o modal só mostra as abas "Receita" e "Despesa" (linha 900-904 do `TransactionFormModal.tsx`). A aba "Transf. entre Contas" é ocultada propositalmente no modo edição. Isso impede que o usuário converta um lançamento comum em transferência.

### Solução
Permitir a aba "Transferência" também no modo edição, mas com comportamento especial:

**No `TransactionFormModal.tsx`:**
- Mudar o bloco de tabs (linhas 900-911) para sempre mostrar 3 abas, independente de `isEditing`
- Quando o usuário estiver editando e mudar para a aba "transferencia":
  - Pré-preencher o formulário de transferência com os dados do lançamento sendo editado (descrição, valor, data)
  - Pré-selecionar a conta atual do lançamento como "Conta de Origem"
- Ao salvar a transferência no modo edição:
  - Deletar o lançamento original (via `onUpdate` ou chamada direta)
  - Criar os 2 lançamentos de transferência (despesa na origem + receita no destino com `transfer_id` compartilhado)
- Manter bloqueio para lançamentos que JÁ são transferências (`transfer_id` existente) — nesses casos, não permitir edição do tipo

### Exceção
Se o lançamento já possui `transfer_id` (já é uma transferência), bloquear a troca de tipo para evitar inconsistências na reconciliação.

## 2. Duplicação por Sobreposição de Datas entre Extratos

### Entendimento
A duplicação aconteceu porque dois extratos diferentes (janeiro e fevereiro) tinham transações na mesma data de fronteira, gerando o mesmo `external_id`. A migration com unique index que acabamos de criar **já resolve** esse problema para importações futuras — o banco agora rejeita inserções com `external_id` duplicado, e o `createMultipleTransactions` filtra antes de inserir.

**Nenhuma mudança adicional necessária** para esse ponto — já está corrigido.

## Arquivo afetado
| Arquivo | Ação |
|---------|------|
| `src/components/lancamentos/TransactionFormModal.tsx` | Mostrar aba transferência na edição + lógica de conversão |

## Detalhes Técnicos

```text
FLUXO DE CONVERSÃO (edição → transferência):
  1. Usuário abre edição de lançamento comum (ex: despesa)
  2. Clica na aba "Transf. entre Contas"
  3. Formulário pré-preenchido com dados do lançamento
  4. Seleciona conta destino
  5. Ao salvar:
     a) Deleta lançamento original (id)
     b) Cria 2 novos lançamentos com transfer_id compartilhado
     c) Fecha modal
```

