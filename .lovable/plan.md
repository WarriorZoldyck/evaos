## Diagnóstico

Duas causas confirmadas para o comportamento reportado:

1. **Descrição aparece como "máscara" (placeholder cinza) e fornecedor fica "(opcional)":** No `ImportStatementModal.tsx`, o merge do auto-preenchimento é `{ ...initDescriptions, ...prev }` (linhas 837-838). O `prev` sempre sobrescreve o `initDescriptions`. Quando o usuário já tem uma sessão persistida no `localStorage` (auto-save do fluxo antigo, onde a regra populava strings vazias e contatos vazios), o restore repovoa `rowDescriptions` / `rowContacts` com esses valores vazios; o auto-fill roda depois mas não consegue sobrescrever. Resultado: descrição fica `""` → o `Input` mostra `placeholder={r.description}` em cinza (parece máscara) e `canConfirm=false` → toggle "Criar" desabilitado. Fornecedor idem.

2. **Efeito colateral do estilo click-to-edit:** com `border-transparent bg-transparent`, o Input vazio fica visualmente indistinguível de um label "com máscara" — reforça a confusão.

## Plano de correção

### Arquivo: `src/components/lancamentos/ImportStatementModal.tsx`

- Trocar o merge de auto-preenchimento para **priorizar valores não-vazios**:
  - `rowDescriptions`: para cada índice em `initDescriptions`, aplicar só se `prev[i]` estiver ausente **ou** string vazia/whitespace. Preserva edições reais do usuário; sobrescreve os `""` legados salvos por sessões antigas.
  - `rowContacts`: para cada índice em `initContacts`, aplicar só se `prev[i]` não tiver `supplier_id` nem `client_id` preenchidos.
- Como esse fluxo só roda logo após parse de um novo upload, não há risco de pisar em edições recentes do usuário.

### Arquivo: `src/components/lancamentos/import/ReconcileStep.tsx`

- Ajustar o estilo do `Input` de descrição para não parecer "máscara" quando vazio: manter o visual leve mas com uma borda pontilhada discreta (`border-dashed border-muted-foreground/30`) quando o valor está vazio, e borda normal quando preenchido. Isso deixa claro que o campo é editável mesmo com pouco contraste.

### Verificação

- Após o deploy, o usuário simoespaula deve:
  1. Recarregar a tela — o auto-fill sobrescreve os `""` legados restaurados da sessão.
  2. Ver descrição preenchida com o texto do extrato (ex.: "SPAY *POLIMPORT - CO 12/12").
  3. Ver fornecedor pré-preenchido quando houver match (exato ou fuzzy).
  4. O toggle "Criar" fica habilitado porque `canConfirm` passa a ser `true`.
- `tsgo` no arquivo alterado.
