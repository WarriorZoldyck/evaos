---
name: Planejamento em duas camadas
description: Metas Orçamentárias (fluxo de caixa) vs Objetivos (destino da sobra) na página /metas
type: feature
---

O módulo de Planejamento tem duas camadas conceituais distintas — nunca misturar o vocabulário:

1. **Metas Orçamentárias** — médias de entradas/saídas por categoria, metas de aumento de receita e corte de despesa, "Nova Capacidade Mensal" e "Nova Sobra até dezembro".
2. **Objetivos** ("Meus Objetivos") — destino da sobra. Tipos: `reserva`, `sonho`, `investimento`, `divida`, `outro`.

Tabela `goals`: `goal_type`, `allocation_mode` (`fixed` | `percent`), `allocation_percent`; valor fixo mensal em `auto_reserve_amount`.

Regras:
- A alocação percentual é calculada sobre a capacidade mensal simulada.
- Nenhum objetivo pode alocar mais que a sobra livre (`src/lib/allocation.ts`).
- Botão "Usar o que vai sobrar" fica ao lado do card de Nova Sobra e abre o criador de Objetivo.
- Prompts da EVA devem usar "metas orçamentárias" x "objetivos".
