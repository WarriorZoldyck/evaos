---
name: Transfer invariant
description: Any transaction with transfer_id must be flagged as internal transfer — enforced by DB trigger
type: constraint
---

Invariante de arquitetura no banco: **`transactions.transfer_id IS NOT NULL ⇒ is_internal_transfer = true`**.

Garantido pelo trigger `transactions_enforce_transfer_flag` (`BEFORE INSERT OR UPDATE`) que chama a função `public.enforce_transfer_flag()`. Se qualquer código (frontend, edge function, WhatsApp AI, importador de extrato) esquecer de setar a flag ao criar par de transferência, o banco corrige sozinho.

**Por quê:** faturamento, DRE e relatórios excluem transferências internas via `is_internal_transfer=false`. Sem essa invariante, transferências entre contas do mesmo dono (ex.: pró-labore Empresa→Pessoal) contam 2× como receita, inflando o faturamento e gerando reclamações do tipo "os valores não batem".

**Não desative** esse trigger. Se precisar de exceção legítima (transferência que deve contar como receita), crie um tipo/coluna nova em vez de usar `transfer_id` sem a flag.
