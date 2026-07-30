## Fase 2 — Motor de conciliação para conta corrente

A Fase 1 (parser dedicado) já está pronta. A Fase 2 melhora o que acontece **depois** do parse, na tela de conciliação, para extratos de conta/débito. O cartão continua intocado: toda a lógica nova entra em caminhos condicionados a `importType === "debito"`.

Entrego em três etapas independentes, na ordem abaixo.

---

### Etapa 2A — Deduplicação de extrato (maior risco hoje)

Hoje nada impede o usuário de importar o mesmo extrato duas vezes e duplicar meses inteiros de lançamentos.

- Nova coluna `import_fingerprint` (texto) na tabela de lançamentos, com índice único parcial por usuário — mesma linha de extrato nunca entra duas vezes.
- A impressão digital é calculada a partir de: conta destino + data + valor + descrição normalizada (sem acento, sem espaços duplos, maiúsculas) + tipo.
- Ao entrar na etapa de conciliação, o sistema consulta as impressões digitais já existentes e marca as linhas repetidas com um selo **"Já importado"**, deixando-as desligadas por padrão (não serão criadas).
- O usuário ainda pode forçar a criação ligando o toggle — nesse caso o registro entra sem impressão digital, para não brigar com o índice.

### Etapa 2B — Transferências internas

Extrato de conta traz TED/PIX/transferências entre as contas do próprio usuário. Hoje elas viram receita ou despesa comum e inflam o DRE.

- Detector por descrição (PIX ENVIADO/RECEBIDO, TED, DOC, TRANSF, RESGATE, APLICAÇÃO) combinado com o nome/CNPJ das outras contas do usuário.
- Linha detectada ganha selo **"Transferência?"** e, ao criar, já nasce com a marcação de transferência interna, ficando fora do DRE (mesma regra já existente no sistema).
- Detecção é sugestão, nunca imposição: um clique desfaz.

### Etapa 2C — Auto-preenchimento por histórico (paridade com o cartão)

O cartão já pré-preenche fornecedor, descrição e categoria pelo histórico; conta ainda não.

- Reaproveitar a busca de histórico de 180 dias já usada no fluxo de cartão, aplicada às linhas de conta.
- Pré-preencher fornecedor (fuzzy), descrição e categoria/subcategoria quando houver lançamento parecido no passado.
- Campos continuam editáveis com o mesmo padrão "clique para editar" já existente.

---

### Detalhes técnicos

- **Banco:** migração adicionando `import_fingerprint text` em `public.transactions` + `CREATE UNIQUE INDEX ... ON public.transactions (user_id, import_fingerprint) WHERE import_fingerprint IS NOT NULL`. Sem mudança de RLS (a tabela já é escopada por `user_id`).
- **Frontend:** `src/components/lancamentos/ImportStatementModal.tsx` (efeito de matching do modo débito, montagem do payload de criação) e `src/components/lancamentos/import/ReconcileStep.tsx` (novos selos e estados de linha). Helpers puros novos em `src/lib/import/` (`fingerprint.ts`, `transferDetect.ts`) com testes em Vitest.
- **Escopo protegido:** nenhuma alteração no caminho `importType === "cartao"`, no motor `useImportMatching` para cartão, nem na Edge Function da Fase 1.
- Cada etapa termina com typecheck + testes verdes antes de eu seguir para a próxima.

### Fase 3 (depois, não incluída aqui)

Conciliar uma linha de extrato contra múltiplos lançamentos do sistema (rateio/lote).
