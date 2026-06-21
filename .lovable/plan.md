
# Conciliação lado-a-lado no Importar Extrato

## Para a Marcela (sem termo técnico)

Hoje, ao subir um extrato (OFX/CSV/PDF), a sugestão de "vincular" aparece junto da tabela de conferência — funciona, mas mistura tudo numa tela só. Os melhores BPOs separam isso em uma etapa dedicada: **de um lado a linha do extrato do banco, do outro o lançamento que o EVA já tem cadastrado, e um botão "Conciliar" no meio**. O que sobrar sem par fica numa segunda lista "Criar no sistema" — você decide o que importar como novo e o que ignorar.

Esse é, sim, o padrão de mercado (Conta Azul, Omie, QuickBooks): chama-se "conciliação assistida". É melhor que mostrar tudo junto porque:
- O olho bate rápido (mesma data, mesmo valor, mesma descrição lado a lado).
- Você não precisa decidir nada para as linhas que o sistema já achou par — só confirma em lote.
- Sobra uma lista enxuta de "novos" para você categorizar.

Depois de importar, o EVA abre a tela de Lançamentos já filtrada nos **novos sem categoria**, prontos para você atribuir centro de custo/categoria.

---

## Fluxo do wizard

```text
[ 1.Arquivo ] → [ 2.Conferir ] → [ 3.Conciliar ] → [ 4.Resumo ]
```

### Etapa 3 — Conciliar (nova UI lado-a-lado)

Duas seções verticais:

**A) Correspondências encontradas** (cabeçalho: "X linhas com par no EVA · [Conciliar todos]")

```text
┌─ Extrato do banco ──────────────┬─ Lançamento no EVA ─────────────┬──────────────┐
│ 05/06  ALUGUEL JUN     -3.500,00│ 05/06  Aluguel Junho  -3.500,00 │ [✓ Conciliar]│
│                                  │ Pendente · Imóvel · ACME Imov.  │ [Trocar ▾]   │
├──────────────────────────────────┼──────────────────────────────────┼──────────────┤
│ 06/06  PIX JOAO        +1.200,00 │ 06/06  Cliente João   +1.200,00 │ [✓ Conciliar]│
│                                  │ Pendente · Vendas · João Silva  │ [Trocar ▾]   │
└──────────────────────────────────┴──────────────────────────────────┴──────────────┘
```

- "Trocar" abre popover com outros candidatos + opção "Buscar manualmente…" (reaproveita `ManualMatchModal`).
- Botão de cabeçalho **Conciliar todos** marca todos em lote.
- Cada linha pode ser desmarcada → cai para a seção B como "criar novo".

**B) Sem correspondência — criar no sistema** (cabeçalho: "Y linhas novas · [Selecionar todos]")

Tabela compacta (igual ao "Conferir" atual): data, descrição, valor, categoria padrão, ✓ selecionar / 🚫 ignorar.

**Rodapé fixo:**
```text
[ Voltar ]   Resumo: 12 conciliar · 8 criar · 2 ignorar   [ Importar ]
```

### Etapa 4 — Resumo pós-import

Tela curta confirmando: "12 conciliados · 8 criados · 2 ignorados" + dois botões:
- **Ver novos para categorizar** → fecha modal, navega para `/lancamentos` com filtro pré-aplicado: `categoria=__sem_categoria__` + janela de datas do extrato + flag de origem `?origem=import:<batchId>`.
- **Fechar**.

---

## Mudanças técnicas

**Reorganização (sem reescrever o motor já existente — `useImportMatching` + `lib/import/matching.ts` permanecem):**

- `src/components/lancamentos/ImportStatementModal.tsx`
  - Refatorar para steps explícitos: `'arquivo' | 'conferir' | 'conciliar' | 'resumo'` (state machine simples).
  - Remover bloco de matching da tela "Conferir" (linhas ~760–890) e mover para nova etapa.
  - Adicionar tela de Resumo com CTA "Ver novos para categorizar".

- `src/components/lancamentos/import/ReconcileStep.tsx` (novo)
  - Recebe `rows`, `matches`, `matchActions`, `matchTargets` e callbacks.
  - Renderiza as duas seções (Conciliar / Criar novo) lado-a-lado.
  - Integra popover "Trocar correspondência" + botão "Buscar manualmente" que abre `ManualMatchModal`.

- `src/components/lancamentos/import/ReconcileRow.tsx` (novo)
  - Linha lado-a-lado (extrato | EVA | ação).

- `src/pages/Lancamentos.tsx`
  - Ler `?origem=import:<batchId>&sem_categoria=1&from=YYYY-MM-DD&to=YYYY-MM-DD` na primeira renderização e aplicar nos filtros existentes (já há sentinel `__sem_categoria__`).
  - `batchId` = uuid gerado no momento do import, salvo num novo campo opcional `import_batch_id text` em `transactions` (apenas nas linhas criadas pelo import, para destacar/filtrar). **Migration:** `ALTER TABLE transactions ADD COLUMN import_batch_id text NULL` + índice parcial.

**Persistência (mantém o que já existe):**
- "Conciliar" → `UPDATE transactions SET status='Pago', payment_date=<data extrato>, is_reconciled=true WHERE id=? AND status='Pendente'`.
- "Criar" → insere com `import_batch_id` preenchido.
- "Ignorar" → nada.

**Fora do escopo desta v1 (mantém o que o plano original já definiu):**
- Match em recorrências projetadas (segue só Pendente real).
- Conciliação de fatura de cartão (tem fluxo próprio).
- Match many-to-one.

---

## Critérios de aceite

1. Importar OFX com 10 linhas, 6 já cadastradas como Pendente → etapa Conciliar mostra 6 pares na seção A e 4 na seção B.
2. Clicar **Conciliar todos** + **Importar**: as 6 Pendentes viram Pago com data do extrato; 4 novas são criadas com `import_batch_id`; nada duplicado.
3. Tela de Resumo aparece com os números corretos e botão **Ver novos para categorizar**.
4. Ao clicar, abre `/lancamentos` filtrado em "Sem categoria" mostrando exatamente as 4 recém-criadas.
5. Botão "Trocar" em uma linha conciliada permite escolher outro candidato ou abrir busca manual.
6. Desmarcar uma linha da seção A move ela para B como "criar novo".
7. Regressão: extratos de cartão (`importType='cartao'`) pulam a etapa Conciliar (vai direto Conferir → Resumo), mantendo comportamento atual.

## Estimativa
Médio — 2 componentes novos, 1 migration trivial (`import_batch_id`), refactor do modal em steps, leitura de query params na página de Lançamentos. Sem mudança no motor de matching.
