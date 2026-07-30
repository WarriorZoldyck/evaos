## Antes da Fase 3

Verifiquei o código: as Fases 1 e 2 já estão inteiras e valem para os dois modos (conta e cartão):

- Parser dedicado por `statementKind` ("conta" | "cartao") — feito.
- Deduplicação por `import_fingerprint` + índice único — feito.
- Detecção de transferência interna (`transferDetect.ts`) — feito.
- Fuzzy de contato, descrição pelo histórico de 180 dias e sugestão de categoria — já rodam para todas as linhas, sem depender do modo.

Ou seja, não há dívida técnica bloqueando. O único item pendente é **validação com dado real**: subir o extrato Santander de janeiro na conta `simoespaula` e conferir créditos, débitos e datas. Sugiro fazer isso em paralelo, sem travar a Fase 3.

## Fase 3 — Conciliação em lote (1↔N)

Hoje cada linha do extrato só pode virar: vínculo 1-para-1, criação nova, ou ignorar. Faltam os dois casos reais mais comuns:

**Caso A — 1 linha do extrato ↔ N lançamentos do sistema.**
Exemplo: um débito único de R$ 3.400 no banco que no sistema está lançado como 3 contas a pagar separadas.

**Caso B — N linhas do extrato ↔ 1 lançamento do sistema.**
Exemplo: uma nota de R$ 1.200 no sistema paga em duas transferências no extrato.

### Como vai funcionar na tela

Na linha do extrato, ao lado de "É o mesmo", entra a ação **"Agrupar…"**. Ela abre um painel com:

- a linha do extrato fixada no topo (data, descrição, valor);
- a lista de candidatos do sistema na janela de datas, com checkbox;
- um contador ao vivo: `selecionado R$ X / extrato R$ Y — falta R$ Z`;
- o botão de confirmar só habilita quando a soma bate dentro da tolerância de centavos já usada no motor atual.

Para o Caso B, o mesmo painel permite marcar **outras linhas do extrato** para somarem contra um único lançamento do sistema, com o mesmo contador invertido.

Grupos confirmados descem para a seção "Resolvidos", com badge **"Agrupado (N)"** e opção de desfazer — igual ao comportamento atual de "É o mesmo".

### Efeito na importação

- Nenhuma transação nova é criada para linhas agrupadas: os lançamentos do sistema envolvidos são marcados como conciliados e recebem a data efetiva do extrato.
- O `import_fingerprint` da linha é gravado no grupo, para o extrato não voltar duplicado numa reimportação.
- O balanço final (extrato como fonte absoluta) passa a contar o grupo pelo valor do extrato, e não pela soma dos lançamentos — evitando a divergência falsa que já corrigimos antes.

### Parte técnica

- `src/lib/import/grouping.ts` (novo): funções puras `sumCandidates`, `validateGroupBalance`, `buildGroupPlan`, com testes em `grouping.test.ts`.
- `src/hooks/useImportMatching.ts`: expor os candidatos da janela por linha (hoje só o melhor + alternativas), para alimentar o painel.
- `src/components/lancamentos/import/GroupMatchDialog.tsx` (novo): painel de agrupamento, reaproveitando `VirtualCommandList` para listas grandes.
- `src/components/lancamentos/import/ReconcileStep.tsx`: novo estado `groups: Record<number, { systemIds: string[]; extraRowIdx: number[] }>`, ação "Agrupar…", badge e desfazer; integrar `groups` no cálculo de resolvidos/pendentes e na cobertura.
- `src/components/lancamentos/ImportStatementModal.tsx`: incluir `groups` no snapshot de sessão do localStorage e aplicar o plano de grupo no commit da importação (update de `is_reconciled`, `payment_date`, `import_fingerprint`).
- Sem migração de banco: as colunas necessárias já existem.

### Ordem de execução

1. `grouping.ts` + testes.
2. Exposição de candidatos no hook.
3. `GroupMatchDialog`.
4. Integração no `ReconcileStep` (estado, badges, resolvidos).
5. Commit da importação + persistência de sessão.
6. Typecheck e suíte de testes.
