# Corrigir o campo "Novo gasto alvo" do simulador

## Problema

O campo numérico é totalmente controlado pelo percentual do slider: a cada tecla digitada o valor é reconvertido em percentual arredondado e imediatamente reescrito na caixa. Ao digitar "3000", o primeiro dígito "3" já vira 100% de corte e o campo volta para 0 — impossível terminar de digitar.

## O que fazer

- Manter um valor de rascunho local enquanto o usuário digita, sem reescrever o campo a cada tecla.
- Aplicar o valor (converter para percentual) apenas ao sair do campo (blur) ou ao pressionar Enter.
- Sincronizar o campo de volta com o slider quando o slider/percentual muda por fora.
- Permitir campo vazio temporariamente e limitar o valor final ao intervalo válido (0 até a média atual em saídas; média atual até o dobro em entradas).
- Aceitar percentuais fracionados internamente para que o valor digitado bata exatamente com o alvo, exibindo o percentual arredondado no rótulo.
- Mesmo comportamento vale para o modo entradas ("Novo faturamento alvo").

## Detalhes técnicos

Arquivo: `src/components/metas/planejamento/FinancialOverview.tsx` (componente `OverviewDetailPanel`).
Adicionar `draft` via `useState` + `useEffect` de sincronização com `projected`; handlers `onChange` (só atualiza rascunho), `onBlur` e `onKeyDown` (Enter) que fazem o commit chamando `onPercentChange`. Nenhum outro arquivo é alterado.
