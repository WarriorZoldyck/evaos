
# Redesign de Metas — mais próximo do Mercado Pago

Escopo focado em dois pontos escolhidos: **Lista de metas (Cofrinhos)** e **Tela de detalhe**. Paleta verde aplicada **apenas dentro do módulo `/metas`** — o resto do app segue com o cyan EVA.

## 1. Paleta verde local (escopo Metas)

Introduzir tokens semânticos locais no `src/index.css`, aplicados só via classe container `.metas-scope`:

```css
.metas-scope {
  --primary: 152 60% 42%;         /* verde MP ~#2BAE66 */
  --primary-foreground: 0 0% 100%;
  --primary-glow: 152 70% 55%;
  --ring: 152 60% 42%;
}
```

Aplicar `className="metas-scope"` no wrapper das páginas `Metas.tsx` e `MetaDetalhe.tsx`. Nenhum hardcode de cor — tudo continua usando `text-primary`, `bg-primary/10`, etc.

## 2. Lista de metas (`src/pages/Metas.tsx`)

Reformatar para se aproximar da tela "Meus cofres":

- **Header enxuto:** título "Cofrinhos" + subtítulo curto, sem botão grande. Botão "Nova meta" vira ícone `+` circular no canto direito.
- **Card de saldo total:** fundo sólido verde-escuro suave (`bg-primary/10` sobre superfície), valor grande em fonte mono, label "Total guardado" acima em caps pequeno, linha secundária "X cofrinhos ativos". Sem gradiente diagonal.
- **Seção "Meus cofrinhos":** título pequeno em muted, e cada meta como linha em `GoalListItem` com:
  - ícone de boia dentro de círculo verde-claro (sem anel de progresso ao redor — o progresso vai virar uma **barra fina** abaixo do nome, estilo MP);
  - nome em peso médio, valor guardado grande à direita, meta e % em linha secundária;
  - separadores sutis (`divide-y divide-border`) em vez de cards individuais com borda — visual de extrato.
- **Empty state:** manter sugestões, mas em lista vertical com o mesmo padrão (ícone circular + texto), não em grid de cards.

## 3. Tela de detalhe (`src/pages/MetaDetalhe.tsx`)

Aproximar da referência com boia + ações:

- **Topbar:** back arrow à esquerda + nome da meta centralizado + ícone de menu (⋮) à direita abrindo `DropdownMenu` com Editar / Excluir. Remove o botão de lixeira solto.
- **Bloco herói:** boia radar grande centralizada (mantém `GoalRadarLarge`, mas com traço mais fino e ícone maior), abaixo o valor em fonte mono bem grande, e "de R$ X · Y%" em muted. Badge "Meta atingida" só quando 100%.
- **Ações em pílula:** trocar os 3 quadrados por 3 botões arredondados horizontais estilo MP:
  - `Reservar` (primary sólido verde), `Retirar` (outline), `Configurar` (ghost com ícone).
  - Layout: `flex gap-2 justify-center`, cada botão com ícone acima do label em telas estreitas OU ícone+label inline em telas largas.
- **Seção "Guarde automaticamente":** título menor, dois cards empilhados (não grid) em mobile — cada card com ilustração/ícone à esquerda, título + descrição no meio, chevron à direita. Badge "Ativo" verde-claro quando configurado.
- **Movimentações:** lista estilo extrato: sem cards individuais, apenas `divide-y`, ícone menor (h-6), data agrupada por dia com header sticky leve ("Hoje", "Ontem", "12 de nov").

## 4. Componentes ajustados

- `src/components/metas/GoalListItem.tsx` — remover SVG circular de progresso, adicionar barra horizontal fina (`h-1 rounded-full bg-muted` com fill `bg-primary`), reorganizar tipografia.
- `src/components/metas/GoalRadarLarge.tsx` — traço mais fino (strokeWidth 4), boia maior e mais central, remover fundo circular pesado.
- Novo helper `formatRelativeDate` inline para agrupar movimentações por "Hoje/Ontem/data".

## 5. Detalhes técnicos

- Sem mudanças em `useGoals`, schema ou modais existentes (`GoalFormModal`, `GoalAmountModal`, `GoalHistoryModal`).
- Sem mudanças de rota — `/metas` e `/metas/:id` já existem.
- Paleta verde escopada evita afetar dashboards, sidebar, gráficos e outros módulos.
- Mantém acessibilidade: contraste verde primary vs foreground validado em light/dark.

## Fora de escopo (para próxima iteração, se pedido)

- Redesign dos cards de auto-reserva no estilo promocional MP com ilustrações.
- Nova tela de movimentações completa (`GoalHistoryModal`).
