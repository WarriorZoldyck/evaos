

# Corrigir Fluxo de Importação de Extrato: Conta + Tipo de Lançamento

## Problema
Hoje o seletor "Conta destino" mistura contas bancarias, carteiras e cartoes de credito em uma unica lista. O fluxo correto deve ser:

1. Primeiro: selecionar a **conta bancaria** (ou carteira) de destino
2. Segundo: perguntar se o extrato e de **debito em conta** ou de **cartao de credito**
3. Se for cartao: mostrar um segundo seletor para escolher qual cartao (auto-detectando pelos ultimos 4 digitos do extrato)

## O que muda

### `src/components/lancamentos/ImportStatementModal.tsx`

**Estado**: substituir `targetAccount` (string unica) por 3 estados:
- `targetBankAccount` — conta bancaria ou carteira selecionada (`bank:id` ou `wallet:id`)
- `importType` — `"debito"` ou `"cartao"` (aparece apos selecionar conta)
- `targetCard` — cartao selecionado (aparece apenas se `importType === "cartao"`)

**UI — 3 campos em sequencia**:
1. **"Conta destino"** — lista apenas contas bancarias e carteiras (sem cartoes)
2. **"Tipo de extrato"** — aparece apos selecionar conta. Opcoes: "Debito em conta" / "Cartao de credito"
3. **"Cartao"** — aparece apenas se tipo = cartao. Lista os cartoes de credito. Auto-detecta pelos 4 digitos

**Auto-deteccao**: apos parsing, se detectar 4 digitos de um cartao nas descricoes:
- Setar `importType = "cartao"` automaticamente
- Pre-selecionar o cartao detectado em `targetCard`
- Manter aviso visual

**handleImport**: 
- Se `importType === "debito"`: usar `bank_account_id` ou `wallet_id` da conta selecionada, `credit_card_id = null`
- Se `importType === "cartao"`: usar `credit_card_id` do cartao selecionado, e `bank_account_id`/`wallet_id` da conta tambem (pois o cartao esta vinculado a uma conta)

**Validacao**: exigir conta + tipo. Se tipo = cartao, exigir cartao tambem.

## Arquivos afetados
- `src/components/lancamentos/ImportStatementModal.tsx` — unico arquivo a alterar

