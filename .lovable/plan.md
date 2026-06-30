
# Conciliação 2.0 — Modelo de 4 Quadrantes

Reorganizar `ReconcileStep.tsx` para refletir exatamente a matriz desenhada: cada linha cai num dos 4 cenários abaixo, com ações claras e regras de tolerância explícitas.

## A matriz

```text
┌──────────────────────────────┬──────────────────────────────┬─────────────────────────────────┐
│ EXTRATO                      │ SISTEMA                      │ AÇÃO                            │
├──────────────────────────────┼──────────────────────────────┼─────────────────────────────────┤
│ 1. 100,00  Ref XYZ           │ 100,00  Categoria XYZ        │ ① Casar (baixa automática)      │
│ 2. 101,20                    │ 101,19                       │ ① Casar c/ desconto             │
│                              │                              │ ② Observar / Categorizar        │
│ 3. 105,00                    │ —                            │ ① Criar  ② Vincular manual      │
│ 4. —                         │ 115,25                       │ ① Excluir  ② Editar/Reagendar   │
└──────────────────────────────┴──────────────────────────────┴─────────────────────────────────┘
```

## Layout novo da tela

Quatro seções colapsáveis, cada uma com cor/ícone próprios e contador:

1. **Match perfeito** (verde · Check) — valor idêntico, dentro da janela
   Ações: `Casar` (default) · `Trocar` · `Já existe — não importar`

2. **Tolerância de centavos** (amarelo · Scale) — diferença ≤ R$ 0,05 (configurável)
   Mostra a diferença ao lado (ex: `Δ -0,01`)
   Ações: `Casar c/ ajuste` (lança a diferença como desconto/juros conforme sinal) · `Observar` (manda pra fila e abre seletor de categoria) · `Importar como novo`

3. **Só no extrato** (azul · Plus) — sobra no banco
   Ações: `Criar lançamento` (default) · `Vincular manual` (popover de busca) · `Ignorar`

4. **Só no sistema** (vermelho · AlertTriangle) — fantasmas / previstos não pagos
   Reaproveita o painel atual de "Orphans" e adiciona ações por item:
   `Excluir` · `Editar / Reagendar` (abre modal com nova data) · `Manter como previsto`

## Regras de negócio (rodapé do desenho)

- **Janela de busca:** 35 dias (default, ajustável por aba: 5 para cartão, 35 para conta).
- **Tolerância centavos:** ±R$ 0,05 → Quadrante 2. Acima disso, vira Q3+Q4.
- **Desconto/Juros automático:** quando o usuário escolhe `Casar c/ ajuste`, criamos um lançamento-filho da categoria "Descontos obtidos" (extrato < sistema) ou "Juros/Multas" (extrato > sistema) com a diferença.
- **Vínculo manual selecionando do extrato:** botão `Bater selecionando` em Q3 e Q4 → abre `ManualMatchModal` já existente, mas passando o lado oposto como fonte.
- **Volumetria:** processar em lote de 70 itens por vez (paginação interna) para não travar a UI em extratos grandes.

## Arquivos a tocar

- `src/components/lancamentos/import/ReconcileStep.tsx` — reescrever o corpo nos 4 quadrantes; consolidar tooltips/alerts atuais.
- `src/lib/import/matching.ts` — adicionar campo `tier: "exact" | "tolerance" | "none"` no `MatchScore` para o front classificar sem recalcular. Atualizar testes.
- `src/hooks/useImportMatching.ts` — expor `tolerance` (default 0,05) e propagar `tier`.
- `src/components/lancamentos/ImportStatementModal.tsx` — passar `orphans` + handlers `onDeleteOrphan` / `onRescheduleOrphan` (já existe deleção; adicionar reschedule chamando `updateTransaction`).
- (Opcional) `src/components/configuracoes/TransactionFieldsCard.tsx` — slider de tolerância (default 0,05) salvo no profile.

## Fora do escopo (anotado pra depois)

- Reabrir a investigação do saldo da Sabrina (Itaú/Santander) — fica como está por enquanto, conforme combinado.
- Aprendizado automático de categoria por descrição já existe; só vamos reaproveitar.

## Resultado esperado

Cada linha do extrato e cada lançamento do sistema vão estar exatamente em **um** quadrante, com ação primária óbvia e ação secundária (avançada) atrás de tooltip. Acaba a sensação atual de "duas ações fazendo quase a mesma coisa" e o usuário entende, batendo o olho, onde a Eva precisa da decisão dele.
