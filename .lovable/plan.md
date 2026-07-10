## Contexto

Dois pontos na tela de importação de extrato / conciliação de cartão:

1. **Bug**: quando o usuário clica **"É o mesmo"** na seção "Provável — confirmar" (ou vincula manualmente) e finaliza a importação, os lançamentos não aparecem como conciliados na tela de Lançamentos.
2. **Melhoria de UX**: no resumo "Sistema × Extrato" (topo da conciliação), hoje só mostramos **Sistema / Extrato / Diferença**. Adicionar de forma clara o **valor original do extrato**, o **valor já conciliado** e manter o **valor restante**, para o usuário entender por que o total vai reduzindo.

## Investigação do bug (o que fazer antes de corrigir)

O código do commit (`ImportStatementModal.tsx` linhas ~817-850) já faz `update({ is_reconciled: true })` na transação vinculada. Ou seja, a marcação chega ao banco (confirmei no DB: existem barbearias com `is_reconciled=true`). O sintoma "não aparece como conciliado" tem 2 causas prováveis:

a) **Cache de listagem não invalida** após o import. Precisamos garantir que o `queryClient.invalidateQueries` das listas de transações roda ao final do commit — incluindo as chaves usadas em `/lancamentos` e no card affected.

b) **Duplicatas idênticas no sistema** (vi 10x "Barbearia" R$ 114,99 pendentes no mesmo cartão). O matcher pode ter vinculado 1 dessas 10 linhas, e a UI mostra as outras 9 (idênticas) ainda como não conciliadas — o usuário enxerga "não conciliou". Nesse caso a correção é **impedir/consolidar duplicatas óbvias** ou pelo menos avisar. Fora do escopo dessa correção — vira memória para o próximo ciclo.

Ação: reproduzir localmente + inspecionar console/network no commit, confirmar (a) e corrigir invalidações.

## Mudanças

### 1) Correção da conciliação após "É o mesmo"

- Auditar `handleConfirm` em `src/components/lancamentos/ImportStatementModal.tsx` (linhas ~800-870):
  - Confirmar que o `update` é bem-sucedido (log de erro claro se falhar) e mostrar contagem real de "conciliadas" no toast final.
  - Ao terminar, invalidar todas as queries relevantes: `transactions`, `credit-card-bills`, `dashboard`, `useImportMatching` — hoje pode estar invalidando só uma parte.
  - Se `matchTargets[idx]` for `undefined` mas o usuário clicou "É o mesmo", cair no branch `criar` silenciosamente é o pior caso — adicionar um `console.warn` + fallback.
- Verificar em `TransactionTable.tsx` que o estado local `reconciled` (linha 179) inicializa de `t.is_reconciled` a cada refetch (não ficar "grudado" no valor antigo por causa de `useState` inicial).

### 2) Resumo aprimorado no cabeçalho "Sistema × Extrato"

Arquivo: `src/components/lancamentos/import/ReconcileStep.tsx` (bloco de resumo, linhas ~441-506).

Adicionar 2 linhas de contexto acima ou ao lado da grid de 3 colunas atual:

```text
Extrato original:  R$ 1.234,56   (N linhas)
Já conciliado:   − R$   400,00   (K linhas casadas)
─────────────────────────────
Restante a tratar: R$   834,56
```

- **Extrato original** = soma de todas as linhas selecionadas do extrato (não muda conforme o usuário interage).
- **Já conciliado** = soma das linhas onde `matchActions[i] === "vincular"` (exact + tolerance + confirmadas via "É o mesmo").
- **Restante** = original − conciliado (é o que hoje aparece implicitamente na coluna "Extrato").

Manter a grid atual "Sistema × Extrato × Diferença" como está (ela compara fatura inteira × extrato inteiro — outra leitura). O novo bloco fica **acima**, com visual mais leve (texto + valores), para não competir com o card colorido de divergência.

Aplicar tanto para modo `card` quanto `debit` (hoje o resumo só aparece em card — estender para débito também faz sentido, é a mesma leitura).

## Fora de escopo

- Deduplicação automática das transações duplicadas ("Barbearia" 10×) — anotar para depois.
- Redesenhar fluxo importar-extrato vs. conciliar-cartão (assunto do plano anterior sobre integração automática).
