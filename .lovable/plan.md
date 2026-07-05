
## Entendi — 3 correções

### 1. Card "Faturamento" está mostrando LÍQUIDO (após MDR) em vez de BRUTO
Essa é a causa principal da divergência. Recalculando o esperado para Implantes BR em junho:

```
Silvia      7.160,00
Heleni      1.386,00
Margarete     670,00
Valdecir    3.900,00
Reyka       2.500,00
Eliseth       445,55
Francisco  10.600,00
Neadis      2.000,00
----------  ---------
Total      28.661,55  ≈ R$ 28.666 informado
```

**Correção:** no card "Faturamento" (e no modal de detalhe), somar o `original_amount` (bruto, antes do MDR) para lançamentos de cartão de crédito/débito e o `amount` para os demais — em vez de sempre somar `amount` (que já vem líquido nas vendas com maquininha).

Arquivos a mexer:
- `src/components/dashboard/SummaryCards.tsx` (cálculo do total do card)
- `src/components/dashboard/FaturamentoDetailModal.tsx` (total e coluna de valor)
- `src/hooks/useDashboardData.ts` se o cálculo estiver lá

### 2. Pró-labores → Transferências Internas (Empresa → Pessoal)
Os 8 lançamentos de pró-labore em junho (R$ 15.127,39) na verdade são movimentações entre contas do mesmo dono: saem de uma conta do contexto **Implantes BR** e caem em uma conta do contexto **Pessoal (Renato Bruggemann)**. Portanto:
- Não devem contar como receita nova em nenhum contexto.
- Devem ter `is_internal_transfer = true` e um `transfer_id` par (par de linhas: uma saída no Implantes BR + uma entrada no Renato).

**Antes de eu executar**, preciso que o cliente confirme:
- **Conta de origem** de cada pró-labore (é sempre a mesma conta PJ da Implantes BR, ou varia? Ex.: "Itaú PJ")
- **Conta de destino** (é sempre a mesma conta PF do Renato, ex.: "BB PF"?)

Se for sempre o mesmo par de contas, executo em uma tacada só. Se variar, vou precisar da lista.

Lista dos 8 pró-labores para o cliente confirmar/anotar origem+destino:

```
15/06  R$ 3.000,00  Pro-labore (pgto Maria Luiza Cruvinel em dinheiro)
15/06  R$ 7.574,00  Pró-labore
17/06  R$ 3.000,00  Pro-labore (Celina depositado direto PF)
18/06  R$   238,00  Pro-labore (pgto Maria Luiza direto PF)
19/06  R$ 1.000,00  Pró-labore (pgto Julia Rinaldi direto PF)
22/06  R$    48,00  Pro-labore (PIX Lirabel PJ)
26/06  R$   150,00  pró-labore (PIX cabelo direto BB)
30/06  R$   117,39  pró-labore (all rede pago PJ)
```

### 3. Neadis (mucocele) R$ 2.000 — vincular ao contexto Implantes BR
Atualmente está sem `company_id`. Vou setar `company_id` = IMPLANTES BR LTDA.

---

### Ordem de execução (após sua confirmação das contas de origem/destino dos pró-labores):

1. **Código (frontend)** — atualizar `SummaryCards.tsx` e `FaturamentoDetailModal.tsx` para somar valor bruto (`original_amount` quando existir, senão `amount`).
2. **Dados (Supabase, via insert tool)**:
   - `UPDATE transactions SET company_id = '<implantes_br_id>' WHERE id = '<neadis_id>'`
   - Para cada pró-labore: setar `is_internal_transfer = true`, criar par espelho na conta PF do Renato com `transfer_id` comum, ajustar `company_id` conforme lado (saída = Implantes BR, entrada = Renato).
3. **Verificar** o total do card Faturamento por contexto:
   - Implantes BR: deve dar R$ 28.661,55 (≈ R$ 28.666)
   - Renato Bruggemann: deve dar R$ 21.280,00 (Antonio 6942 + Julia 5500 + Maria Luiza 6838 (com o ajuste de +R$100 que o cliente atualizou) + Francisco 2000, sem os pró-labores)

---

**Pergunta única para destravar:** qual é a **conta de origem (PJ Implantes BR)** e a **conta de destino (PF Renato)** que devem ser usadas nas transferências dos 8 pró-labores? Se for sempre o mesmo par, é só me dizer os dois nomes (ex.: "Itaú PJ → BB PF") e eu executo tudo.
