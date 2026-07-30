
# Conciliação de extrato de conta corrente (débito/crédito)

## O que já existe hoje (verificado no código)

- O modal **já pergunta o tipo antes do upload** (`Tipo de extrato: 💰 Débito em conta / 💳 Cartão de crédito`) e só libera o arquivo depois da escolha. Ou seja, a pergunta que você sugeriu já está lá — o problema do simoespaula não é essa etapa.
- Existe fluxo de conciliação em modo débito: `ReconcileStep mode="debit"`, matching contra `bank_account_id`/`wallet_id`, ações Vincular / Criar / Ignorar, trava de divergência de total.
- **O que quebra é o parser.** A edge function `parse-bank-statement` recebe apenas o arquivo, sem saber se é fatura ou conta, e usa **um único prompt escrito para fatura de cartão**:
  - manda "Extract ALL purchase/expense transactions" e "se estiver em dúvida use `t: d`" → num extrato de conta, os créditos (PIX RECEBIDO, RESG POUP, REMUNERAÇÃO) tendem a virar despesa;
  - tem lista de EXCLUDE de fatura que, em extrato de conta, pode derrubar linhas reais (ex.: `DEBITO AUT. FATURA CARTAO VISA FINAL 7014` — que numa conta corrente é uma saída legítima de R$ 20.219,75);
  - pede `c` = 4 últimos dígitos do cartão → o "FINAL 7014" do extrato do Santander vira `detected_card_digits` e polui o fluxo de débito;
  - não entende as colunas Crédito/Débito/Saldo: a coluna **Saldo** é um forte candidato a ser lido como valor;
  - a resolução de ano (`resolveRawDateToISO`) depende de `close`/`due` da fatura; sem isso cai em "ano atual". No extrato do Santander há linhas de 02/02/2026 dentro do arquivo de janeiro.

Conclusão: sim, o seu escopo faz sentido — mas o gargalho nº 1 é **parsing específico de extrato de conta**, não o motor de conciliação.

## Escopo proposto (em fases, sem tocar no caminho do cartão)

### Fase 1 — Parser dedicado a extrato de conta (o que destrava o simoespaula)
1. O cliente passa a enviar `statementKind: "conta" | "cartao"` no `FormData` (valor já conhecido pelo `importType`).
2. Na edge function, dois prompts separados:
   - `CARD_SYSTEM_PROMPT`: exatamente o atual, sem mudanças.
   - `ACCOUNT_SYSTEM_PROMPT` (novo): datas completas `DD/MM/AAAA` como impressas; usar as colunas **Crédito** e **Débito** para definir `t` (`r` para crédito, `d` para débito); **ignorar a coluna Saldo**; nunca inferir cartão (`c` sempre null); não excluir tarifas, IOF, juros, débito automático de fatura, pagamentos de boleto, transferências programadas, resgates/aplicações — tudo isso é movimento real da conta; preservar duplicatas.
3. `isExcludedCardStatementLine` e a detecção de `detected_card_digits` só rodam quando `statementKind === "cartao"`.
4. Ano: em modo conta o parser exige data completa; havendo só `DD/MM`, usa o período do extrato (`Período: 01/01/2026 a 31/01/2026`, extraído em `meta`) como referência, em vez de "ano atual".
5. Também para OFX/CSV: hoje `parseOFX` chama `extractOFXAccountDigits` e injeta `detected_card_digits` em toda linha — em modo conta isso não deve acontecer.

### Fase 2 — Ajustes do passo de conciliação em modo conta
1. **Prevenção de duplicidade entre importações**: chave `hash(user_id + conta + data + valor + descrição normalizada)`. Linhas já importadas anteriormente entram marcadas como "já importado" e nascem em Ignorar, com aviso no topo ("12 linhas já existiam de uma importação anterior").
2. **Transferências internas**: linhas como `TRANSFERENCIA PROGRAMADA PARA: 3656.60.009579-6` e `RESG POUP` recebem sugestão de "transferência entre contas" em vez de despesa/receita, respeitando a regra de transferências já existente no sistema.
3. **Regras por palavra-chave** (TARIFA, IOF, JUROS, MENSALIDADE SEGURO, DEBITO AUT. FATURA…) para pré-categorizar, reaproveitando o mecanismo de sugestão de categoria já usado no cartão.
4. **Fornecedor/descrição**: aplicar em modo conta o mesmo fuzzy-match de contato + histórico de 180 dias que já funciona no cartão (`PIX ENVIADO Silvania Novais Brito` → contato "Silvania Novais Brito", descrição do histórico).

### Fase 3 (opcional, depois de validar 1 e 2) — Pagamento em lote (1 débito ↔ N contas a pagar)
Permitir selecionar múltiplos lançamentos do sistema para justificar uma única linha do extrato, com validação de soma = valor da linha. Fica fora das fases 1 e 2 por ser mudança estrutural no `ReconcileStep`.

### Fora deste plano
Ingestão via WhatsApp e Open Finance/CRON — já existem integrações (Pluggy/Itaú) e isso merece um plano próprio.

## Detalhes técnicos
- Arquivos tocados na Fase 1: `supabase/functions/parse-bank-statement/index.ts` (novo prompt + branch por `statementKind`), `src/components/lancamentos/ImportStatementModal.tsx` (enviar `statementKind` no FormData e não aplicar heurísticas de cartão em modo conta).
- Fase 2: `ImportStatementModal.tsx` (dedupe + regras) e `src/components/lancamentos/import/ReconcileStep.tsx` (badges "já importado" / "transferência"); possivelmente um índice/consulta por `(user_id, bank_account_id, payment_date, amount)` para o dedupe — sem migração nova se der para resolver por consulta.
- Nada no caminho `importType === "cartao"` é alterado; todo comportamento novo fica atrás do branch de conta.
- Validação: rodar o PDF `jan26santander.pdf` (66 linhas, com créditos e débitos) pelo parser novo e conferir linha a linha contra o extrato, incluindo o fechamento por saldo.

## Sugestão de execução
Começar pela **Fase 1** isolada e testar com o extrato do simoespaula antes de mexer na Fase 2.
