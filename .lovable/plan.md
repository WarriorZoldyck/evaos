

## Dashboard - Correcoes e Previsao do Mes

### Problema Atual

1. **Faturamento** e **Entradas** calculam o mesmo valor (ambos somam apenas receitas pagas). Faturamento deveria incluir **todas** as receitas do periodo (pagas + pendentes), pois representa o total faturado/emitido. Entradas deve ser apenas o que **efetivamente entrou no caixa** (status = Pago).

2. Nao existe uma visao de **Previsto vs Consolidado** no Dashboard.

---

### Mudancas

**Arquivo: `src/hooks/useDashboardData.ts`**

Ajustar o calculo do `summary`:

| Card | Atual | Novo |
|---|---|---|
| Faturamento | Receitas pagas | **Todas** as receitas do periodo (Pago + Pendente) |
| Entradas | Receitas pagas | Receitas pagas (sem mudanca) |
| Saidas | Despesas pagas | Despesas pagas (sem mudanca) |
| Saldo | entradas - saidas | entradas - saidas (sem mudanca) |

Adicionar novos campos ao summary para a secao de previsao:

- `previstoReceitas`: soma de todas as receitas do periodo (Pago + Pendente)
- `previstoSaidas`: soma de todas as despesas do periodo (Pago + Pendente)
- `consolidadoReceitas`: soma das receitas pagas (= entradas)
- `consolidadoSaidas`: soma das despesas pagas (= saidas)

**Arquivo: `src/components/dashboard/SummaryCards.tsx`**

- Receber as novas props de previsao
- Adicionar uma segunda linha de cards ou uma secao abaixo dos cards principais mostrando:
  - **Previsto**: total de receitas e despesas esperadas no periodo (incluindo pendentes)
  - **Consolidado**: total efetivamente pago no periodo
  - **% Realizado**: percentual consolidado/previsto para receitas e despesas

**Arquivo: `src/pages/Dashboard.tsx`**

- Passar os novos campos do summary para o componente SummaryCards

### Detalhes Tecnicos

No `useDashboardData.ts`, o calculo do summary ficara:

```text
faturamento = todas receitas (Pago + Pendente)
entradas = receitas com status "Pago"
saidas = despesas com status "Pago"
saldo = entradas - saidas

previstoReceitas = todas receitas (Pago + Pendente)
previstoSaidas = todas despesas (Pago + Pendente)
consolidadoReceitas = receitas "Pago"
consolidadoSaidas = despesas "Pago"
```

A secao de previsao sera exibida como um card com duas colunas (Receitas / Despesas), cada uma mostrando o valor previsto, o consolidado e uma barra de progresso indicando o percentual realizado.

