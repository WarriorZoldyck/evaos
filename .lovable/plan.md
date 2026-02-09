
## Bloco 2: Maquininha no Formulario + Data Automatica do Cartao

Este plano implementa as funcionalidades que estao faltando no formulario de lancamentos: select de maquininha, calculo de MDR em tempo real, campos contextuais por forma de pagamento, e auto-ajuste da data ao selecionar cartao de credito.

---

### Problema 1: Cartoes de credito nao trazem `closing_day` e `due_day`

O fetch de `credit_cards` em `useTransactions.ts` so busca `id, name, last_four_digits`. Para auto-setar a data de fechamento ao selecionar um cartao, precisamos tambem de `closing_day`, `due_day` e `bank_account_id`.

**Arquivo:** `src/hooks/useTransactions.ts`
- Alterar a interface `CreditCard` para incluir `closing_day`, `due_day` e `bank_account_id`
- Alterar a query de credit_cards para: `select("id, name, last_four_digits, closing_day, due_day, bank_account_id")`

---

### Problema 2: Maquininha nao aparece no formulario de lancamento

O `cardTerminals` e recebido como prop pelo `TransactionFormModal`, mas **nunca e passado** para o componente interno `MainFormContent`. Alem disso, `MainFormContent` nao tem nenhuma logica para mostrar maquininhas ou calcular MDR.

**Arquivo:** `src/components/lancamentos/TransactionFormModal.tsx`

Mudancas no `MainFormContent`:

**2a. Adicionar props de maquininha e cartoes completos:**
- Adicionar `cardTerminals` na interface `MainFormContentProps`
- Adicionar `creditCards` com `closing_day` e `due_day` (tipo estendido)
- Passar `cardTerminals` nas chamadas de `MainFormContent` (receita e despesa)

**2b. Select de maquininha condicional (receita com cartao):**
- Quando `activeTab === "receita"` E `payment_method` for "Cartao de Credito" ou "Cartao de Debito", mostrar um select de Maquininha
- Novo campo no form schema: `card_terminal_id` (string opcional)
- Ao selecionar uma maquininha, calcular e exibir automaticamente:
  - Taxa aplicavel (debito base, credito base, ou taxa do parcelamento)
  - Valor bruto, Desconto MDR, Valor liquido
  - Data de recebimento estimada (D+N)
  - A conta de recebimento da maquininha e auto-preenchida no `bank_account_id`

**2c. Campos condicionais por forma de pagamento:**
- PIX: mostra select de Conta Bancaria + Carteira
- Dinheiro: mostra select de Carteira
- Boleto: mostra select de Conta Bancaria
- Transferencia: mostra select de Conta Bancaria
- Cartao de Credito (receita): mostra select de Maquininha + MDR
- Cartao de Credito (despesa): mostra select de Cartao de Credito cadastrado
- Cartao de Debito (receita): mostra select de Maquininha + MDR
- Cartao de Debito (despesa): mostra select de Conta Bancaria

**2d. Auto-set da data ao selecionar cartao de credito (despesa):**
- Quando o usuario seleciona "Cartao de Credito" como forma de pagamento E seleciona um cartao especifico
- O sistema calcula a proxima data de fechamento daquele cartao:
  - Se hoje < dia do fechamento, a data e o dia do fechamento do mes atual
  - Se hoje >= dia do fechamento, a data e o dia do fechamento do proximo mes
- Atualiza automaticamente o campo `payment_date` com essa data

**2e. Salvar `card_terminal_id` na transacao:**
- Ao submeter, incluir `card_terminal_id` no `baseData` quando uma maquininha for selecionada
- Incluir o `bank_account_id` da maquininha automaticamente

---

### Problema 3: Calculo de MDR em tempo real

No formulario, quando uma maquininha for selecionada, exibir um bloco informativo (nao editavel) com:

```text
+--------------------------------------------+
| Detalhes da Maquininha: REDE               |
| Taxa: 3.29%                                |
| Valor bruto: R$ 1.000,00                   |
| Desconto MDR: -R$ 32,90                    |
| Valor liquido: R$ 967,10                   |
| Recebimento em: D+2 (15/02/2026)           |
+--------------------------------------------+
```

A logica de calculo:
- Debito: usa `debit_rate` e `settlement_days_debit`
- Credito a vista: usa `credit_rate` e `settlement_days_credit`
- Credito parcelado: busca em `rates_info` o plano que corresponde ao numero de parcelas, ou usa `credit_rate` como fallback

---

### Detalhes Tecnicos

**Arquivos a serem modificados:**

| Arquivo | Mudanca |
|---|---|
| `src/hooks/useTransactions.ts` | Expandir query e interface de `CreditCard` com `closing_day`, `due_day`, `bank_account_id` |
| `src/components/lancamentos/TransactionFormModal.tsx` | Adicionar `card_terminal_id` ao schema, passar `cardTerminals` e creditCards estendidos ao `MainFormContent`, implementar select de maquininha, calculo de MDR, campos contextuais, auto-date do cartao |

**Logica de auto-date para cartao de credito (despesa):**

```text
Dado: closing_day = 26, hoje = 09/02/2026
Se dia_atual (9) < closing_day (26):
  payment_date = 26/02/2026 (mes atual)
Senao:
  payment_date = 26/03/2026 (proximo mes)
```

**Logica de campos contextuais:**

```text
RECEITA:
  PIX -> Conta Bancaria OU Carteira
  Boleto -> Conta Bancaria
  Dinheiro -> Carteira
  Transferencia -> Conta Bancaria
  Cartao Credito -> Maquininha + MDR
  Cartao Debito -> Maquininha + MDR

DESPESA:
  PIX -> Conta Bancaria OU Carteira
  Boleto -> Conta Bancaria
  Dinheiro -> Carteira
  Transferencia -> Conta Bancaria
  Cartao Credito -> Select de Cartao (com auto-date de fechamento)
  Cartao Debito -> Conta Bancaria
```

**Nenhuma migracao de banco necessaria.**
