Vamos aplicar o padrão desses sistemas (Mint/YNAB/Conta Azul/Omie/Nibo) na conciliação da fatura, em duas ondas para você validar cada uma.

## Onda 1 — Linguagem e clareza (sem mexer em algoritmo)

Arquivo: `src/components/lancamentos/import/ReconcileStep.tsx` e `ImportStatementModal.tsx`.

1. **Renomear botões da linha casada:**
   - "Trocar" → **"Outro par"** (só troca o candidato).
   - "Já existe — não importar" → **"Manter só o do sistema"** (tooltip: "Descarta a linha do extrato. Nada é criado nem excluído.").
   - "Importar como novo" → **"É outra compra — criar"** (tooltip: "Cria um lançamento novo. Pode gerar duplicata.").

2. **Renomear quadrante:** "Match perfeito" → **"Igual — pode conciliar"** com contador `12/14` de cobertura da fatura, para quebrar a confusão com o total divergente.

3. **Novo card fixo no topo da etapa de conciliar — Sistema × Extrato:**

   ```text
   ┌─ Fatura Junho/2026 ─────────────────────────────┐
   │  Sistema:     R$ 1.245,80  (12 lançamentos)     │
   │  Extrato:     R$ 1.270,80  (14 linhas)          │
   │  Diferença:   R$ 25,00 ⚠                        │
   │  Prováveis causas:                              │
   │  • 2 linhas só no extrato: "IOF R$18" "AJ R$7"  │
   │  • Nenhum órfão no sistema                       │
   └─────────────────────────────────────────────────┘
   ```

   - **Sistema** = soma de TODOS os lançamentos do cartão no ciclo da fatura (query direta, não depende do matcher).
   - **Extrato** = soma das linhas selecionadas.
   - Se Δ ≠ 0, lista automaticamente as linhas "Só no extrato" + órfãos que somam algo próximo do Δ.

## Onda 2 — Estado de divergência de valor (mexe em lógica)

Arquivo: `src/lib/import/matching.ts` + `ReconcileStep.tsx`.

4. **Novo quadrante "Divergência de valor" (substitui "Diferença de centavos"):**
   - Só no modo cartão, criar `CARD_AMOUNT_TOLERANCE = 2.00` (cobre IOF, câmbio, ajuste de anuidade).
   - Linhas com `EXACT_AMOUNT_TOLERANCE < |Δ| ≤ CARD_AMOUNT_TOLERANCE` viram tier `"divergent"` (não mais "tolerance").
   - Renderização com radio group — uma escolha ativa por vez:
     1. **Usar valor do extrato** (recomendado, atualiza o lançamento no sistema).
     2. **Manter valor do sistema** (só marca conciliado).
     3. **É outra compra — criar** (cria novo).
     4. **Ignorar linha do extrato**.
   - No import, a opção 1 dispara `update` no `amount` do lançamento existente antes de marcar conciliado.

5. **Auto-categorização por histórico** (linhas "Só no extrato"):
   - Se descrição normalizada ≈ 3+ transações passadas com mesma categoria, aplicar sugestão e mover para subgrupo "Já categorizado (revise)".
   - Se sem sugestão, bloquear import da linha até categoria ser definida.

## Fora de escopo (não mexer agora)

- Fluxo de débito continua como está — funciona bem.
- Parser de PDF/OFX, dedup pós-import, regras de recorrência.

## Ordem de entrega

Faço Onda 1 primeiro, você valida com um caso real (fatura com R$ 25 de divergência), e depois libera Onda 2. Assim se algo na renomeação já resolver, evitamos mexer no algoritmo.
