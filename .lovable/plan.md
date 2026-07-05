## Objetivo
Dar ao usuário ferramentas de auditoria para conferir 1-a-1 os lançamentos de receita do período (sem duplicatas, sem valores faltando).

## O que vou adicionar no `FaturamentoDetailModal.tsx`

### 1. Painel de auditoria (no topo, colapsável, abaixo dos 4 cards de resumo)
Mostra em linha compacta:
- **Vendas:** N (contagem de séries agrupadas)
- **Parcelas:** M (contagem de linhas em `transactions`)
- **Pagas:** X (parcelas com status Pago) / **Pendentes:** Y
- **Σ Bruto:** R$ … / **Σ Líquido:** R$ …
- **MDR total:** R$ …
- **Confer:** ✅ se `Σ Bruto − Σ MDR = Σ Líquido`; ❌ se divergir (com o delta)

### 2. Detector de possíveis duplicatas
Botão "🔍 Detectar duplicatas" que roda uma heurística local sobre `filteredLines`:
- Agrupa por chave `normalize(cliente) + valor bruto + mesma competência ± 3 dias`
- Se ≥ 2 vendas caem no mesmo grupo, destaca as linhas com badge âmbar "Possível duplicata" e lista no painel.
- Não deleta nada — apenas sinaliza para o usuário decidir.

### 3. Export CSV do período
Botão "📥 Exportar CSV" que baixa `receitas-YYYY-MM.csv` com uma linha por **parcela** (não por venda agrupada), colunas:
`competência, pagamento, série, parcela, cliente, contato, descrição, categoria, forma, status, bruto, mdr, líquido`.
Isso permite conferir contra extrato bancário / notas fiscais fora do sistema.

### 4. Filtro rápido de status
Adicionar chips ao lado do filtro "Forma de pagamento":
`Todos | Só Pagos | Só Pendentes | Parcial`
Ajuda a bater rapidamente com o extrato (o que já entrou vs o que falta entrar).

## Fora de escopo
- Não altero cálculo de bruto/líquido/MDR (as fórmulas já foram validadas nas rodadas anteriores).
- Não mexo em dados no banco. O usuário `espclin@hotmail.com` faz a conferência manual; se encontrarmos algo específico para corrigir, tratamos em uma tarefa separada.
- Não adiciono nada na tela de Lançamentos — foco no modal de Faturamento que é onde a auditoria está acontecendo.

## Verificação
1. Abrir modal Jun/2026 → conferir se `Σ Bruto − Σ MDR = Σ Líquido` (badge verde).
2. Baixar CSV → abrir em planilha → somar coluna `bruto` → deve bater com o card "Bruto" do modal.
3. Clicar "Detectar duplicatas" → esperado nenhuma no exemplo atual (todos os clientes são únicos).
4. Filtrar "Só Pendentes" → mostra apenas Guilherme, Valdecir e parcelas 3–11 do Claudio.
