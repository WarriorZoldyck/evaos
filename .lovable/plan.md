## Diagnóstico atualizado

O ponto principal agora é: **não dá para tratar toda linha da fatura como soma absoluta**.

Se existe uma restituição/crédito de **R$ 519,33**, a fatura precisa ser calculada como líquido:

```text
Compras/saídas - créditos/restituições = total da fatura
```

Pelo que foi verificado:

- O log da última importação ainda mostrou `statement_total=2266108`, ou seja, a IA leu `R$ 22.661,08` sem a vírgula decimal.
- O parser retornava `parsed_total` usando `Math.abs(...)` em todas as linhas. Isso soma entradas e saídas como se tudo fosse compra, o que é errado para fatura com restituição.
- A UI do passo de reconciliação já tenta calcular um líquido em alguns pontos, mas o backend ainda devolve total bruto, e o rodapé da importação compara contra o total digitado usando a soma das ações selecionadas. Isso pode gerar diferença confusa quando há crédito/restituição.
- A busca por lançamentos existentes encontrou `LAGOA M*ANNE FERNANDES` como **despesa** histórica, mas ainda não confirma a linha exata de **R$ 519,33** na importação atual porque ela ainda está no preview/local ou no parser, não necessariamente gravada no banco.

## O que vou corrigir

### 1. Total do parser: bruto vs líquido
No edge function `parse-bank-statement`:

- Manter dois totais separados:
  - `parsed_gross_total`: soma absoluta de todas as linhas, apenas para auditoria.
  - `parsed_net_total`: soma correta da fatura: despesas somam, receitas/créditos subtraem.
- Usar `parsed_net_total` para comparar com `statement_total` e `diff_cents`.
- Aplicar o rescale `/100` no `statement_total` antes da comparação final, garantindo que `2266108` vire `22661.08`.
- Logar claramente:
  - total informado pela fatura;
  - total bruto parseado;
  - total líquido parseado;
  - diferença em centavos;
  - linhas marcadas como entrada/restituição.

### 2. Classificação segura de restituição/crédito
Ainda no parser:

- Para importação de cartão, `receita` só será aceita se a descrição indicar de fato crédito/restituição, como:
  - `ESTORNO`
  - `DEVOLUCAO` / `DEVOLUÇÃO`
  - `REEMBOLSO`
  - `CREDITO` / `CRÉDITO`, quando claramente for crédito da fatura
- Se a IA marcar uma linha como entrada sem esses gatilhos, o sistema força para **saída** e registra log de override.
- Se a linha for pagamento da fatura/ajuste bancário que não representa compra nem restituição, ela deve ser excluída da lista de lançamentos importáveis.

### 3. Tela de reconciliação: mostrar líquido corretamente
Em `ImportStatementModal` e `ReconcileStep`:

- A diferença contra o “valor da fatura” será calculada com o **total líquido selecionado**, não com soma absoluta.
- O rodapé deve mostrar algo do tipo:

```text
Total da fatura: R$ 22.661,08
Selecionado líquido: R$ XX.XXX,XX
Diferença: R$ X,XX
```

- Se houver créditos/restituições, mostrar uma linha discreta:

```text
Créditos/restituições: -R$ 519,33
```

### 4. Auditoria da linha que está faltando
Para descobrir exatamente onde está faltando chegar em **R$ 22.661,08**:

- Adicionar log resumido das maiores linhas e de todas as entradas/créditos detectados na próxima importação.
- Mostrar no preview uma seção pequena “Entradas/créditos detectados” quando houver linhas como essa de R$ 519,33.
- Assim fica claro se o valor está:
  - vindo do PDF mas classificado errado;
  - sendo excluído indevidamente;
  - sendo somado com sinal invertido;
  - ou se realmente falta uma linha no OCR/IA.

## Resultado esperado

Na próxima importação da mesma fatura:

1. `statement_total` deve aparecer como **R$ 22.661,08**, não `2.266.108`.
2. O sistema deve calcular o total líquido da fatura, descontando a restituição/crédito de **R$ 519,33**.
3. Se `LAGOA ANNE FERNANDES` for compra comum, fica como **Saída**.
4. Se for restituição real, fica como **Entrada/crédito** e aparece destacada como crédito da fatura.
5. A diferença exibida deve apontar exatamente se ainda falta alguma linha para fechar os **R$ 22.661,08**.

## Arquivos envolvidos

- `supabase/functions/parse-bank-statement/index.ts`
- `src/components/lancamentos/ImportStatementModal.tsx`
- `src/components/lancamentos/import/ReconcileStep.tsx`

Sem migração de banco.