

## Template de Lancamento: Campos Customizaveis

### Conceito

Permitir que cada usuario configure quais campos opcionais aparecem no formulario de lancamentos. Campos obrigatorios (descricao, valor, data, categoria, status) permanecem sempre visiveis. Os demais podem ser ligados/desligados na pagina de Configuracoes.

### Campos sempre visiveis (obrigatorios)

- Status (Pendente/Pago)
- Descricao
- Data de Competencia
- Data de Pagamento
- Valor Bruto (R$)
- Categoria

### Campos customizaveis (podem ser ocultados)

| Campo | Padrao |
|---|---|
| Fornecedor / Cliente | Visivel |
| Nome do contato (texto livre) | Oculto |
| Subcategorias (2 niveis) | Visivel |
| Forma de pagamento | Visivel |
| Conta / Cartao / Carteira / Maquininha | Visivel |
| Parcelamento | Visivel |
| Recorrencia | Visivel |
| Observacoes | Visivel |
| Codigo de barras | Oculto |
| Anexo (URL) | Oculto |

### Onde o usuario configura

Na pagina **Configuracoes** (`src/pages/Configuracoes.tsx`), um novo card "Formulario de Lancamentos" com switches para cada campo opcional. As preferencias sao salvas na tabela `profiles` em uma coluna JSON `transaction_form_fields`.

### Detalhes tecnicos

**1. Migracao no banco** -- Adicionar coluna JSONB na tabela `profiles`:

```sql
ALTER TABLE profiles
ADD COLUMN transaction_form_fields jsonb DEFAULT '{
  "supplier_client": true,
  "contact_name": false,
  "subcategories": true,
  "payment_method": true,
  "account_fields": true,
  "installments": true,
  "recurring": true,
  "notes": true,
  "barcode": false,
  "attachment_url": false
}'::jsonb;
```

**2. Hook `useFormFieldSettings`** -- Novo hook em `src/hooks/useFormFieldSettings.ts`:
- Carrega as preferencias do perfil do usuario
- Fornece funcao para atualizar campos individuais
- Retorna objeto com visibilidade de cada campo
- Valores padrao para usuarios que ainda nao configuraram

**3. Pagina Configuracoes** -- Novo card com switches:
- Titulo: "Campos do Formulario de Lancamentos"
- Um Switch para cada campo customizavel
- Salva automaticamente ao alternar (debounce)

**4. TransactionFormModal** -- Condicionar renderizacao:
- Receber props de visibilidade dos campos
- Campos ocultos nao aparecem no form
- Validacao Zod permanece `.optional()` para campos ocultos (ja e assim)
- Valores ocultos sao enviados como `null` ao salvar

**5. Fluxo de dados**:

```text
profiles.transaction_form_fields (JSONB)
        |
  useFormFieldSettings() hook
        |
  Configuracoes.tsx (switches)    +    Lancamentos.tsx (passa para o form)
                                            |
                                  TransactionFormModal (condiciona campos)
```

### Arquivos alterados/criados

1. **Migracao SQL** -- Nova coluna `transaction_form_fields` em `profiles`
2. **`src/hooks/useFormFieldSettings.ts`** -- Novo hook
3. **`src/pages/Configuracoes.tsx`** -- Novo card com switches
4. **`src/pages/Lancamentos.tsx`** -- Passa settings para o form modal
5. **`src/components/lancamentos/TransactionFormModal.tsx`** -- Condiciona renderizacao dos campos opcionais

### Nao altera

- Logica de salvamento (campos ocultos vao como `null`)
- Validacao Zod (campos opcionais ja sao `.optional()`)
- Tabela `transactions` (estrutura permanece igual)
- Dados existentes (nenhum dado e perdido)

