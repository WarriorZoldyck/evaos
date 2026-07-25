## Princípio (fica explícito no código e na UX)

**O extrato é a fonte da verdade.** Ele vem direto do banco/cartão do usuário, então:

- Se um valor está no extrato, ele **aconteceu** — o sistema não pode dizer "não aparece no extrato" quando aparece.
- Divergências de **data** (lançamento manual usou vencimento, extrato traz a compra) ou de **descrição** (nome do estabelecimento diferente do rótulo manual) **não invalidam o par** — o valor e o cartão são suficientes para reconciliar dentro do ciclo da fatura.
- Órfão real ("Só no sistema") = valor que **não existe em lugar nenhum** do extrato daquele ciclo. Só esses ficam para o usuário decidir excluir.

## Problema

Na tela "Conciliar & Categorizar" (cartão), a seção **"Só no sistema"** lista lançamentos com o texto "não aparecem no extrato" — mas ao lado o próprio painel mostra "Mesmo valor no extrato". Isso contraria o princípio acima e obriga o usuário a resolver manualmente.

## Causa

3 baldes independentes no `ImportStatementModal`:
1. `matches` (via `useImportMatching`) — casa por valor + data + descrição numa janela.
2. `onlyStatementRows` — linhas do extrato sem `matches[i].best`.
3. `orphans` — transações do sistema no ciclo que ninguém reivindicou.

Quando data/descrição divergem além da janela, `pickBestMatch` devolve `null` e a mesma compra aparece 2x: "criar" no extrato + "órfã" no sistema.

## Solução (frontend apenas)

Adicionar um **passe de reconciliação por valor pós-matching** no modal, tratando o extrato como fonte da verdade:

### 1. `src/components/lancamentos/ImportStatementModal.tsx`

Novo `useEffect` que roda quando `orphans`, `rows` e `matches` estabilizam, guardado por `ref` para não sobrescrever ações já tocadas pelo usuário:

- Monta dois mapas: `orphansPorValor` (chave = valor absoluto em centavos) e `linhasSemMatchPorValor` (idem, apenas linhas com `matches[i].best == null` e ação "criar" não tocada).
- Para cada valor que existe **exatamente 1 vez** dos dois lados:
  - Promove o par a match sugerido:  
    `matches[i] = { best: { candidate: orphan, suggested: true, tier: "exact", dayDiff, similarity: 0, amountDiff: 0, contactMatched: false, score: 0 }, alternatives: [] }`
  - Define ação `"vincular"` com `target_id = orphan.id`.
  - Remove o `orphan` da lista exibida.
- Se o valor bate em >1 linha ou >1 órfão (ambíguo), **não** auto-vincula — mantém aviso amarelo e botão "É o mesmo" para o usuário escolher qual é qual.

### 2. `src/components/lancamentos/import/ReconcileStep.tsx`

Reescrever cabeçalho e copy da seção "Só no sistema" para refletir o princípio:

- Título/alerta passa a explicar: "Estes valores **não existem no extrato** deste ciclo. Como o extrato é a fonte da verdade, provavelmente são duplicatas, ghosts ou pertencem a outro cartão/fatura — revise e exclua."
- Mantém o bloco "Mesmo valor no extrato" apenas para os casos **ambíguos** que sobraram (>1 candidato do mesmo valor), com botão "É o mesmo" para o usuário desempatar.
- Ícone/tom passa de "erro do sistema" para "revisão do usuário" (mantém o `destructive`, mas ajusta o texto).

### 3. Selo na seção "Igual — pode conciliar"

Pares promovidos pelo passe automático entram como `suggested: true` (o `ScoredCandidate` já suporta). O `ReconcileStep` já renderiza selo diferente para `suggested` — apenas conferir a label ("sugerido pelo valor — confirme") e nada mais.

## Não escopo

- Não altera `matching.ts` nem `useImportMatching` — o comportamento para débito/carteira e os testes existentes ficam iguais.
- Não altera edge functions, schema ou fluxo do WhatsApp / Análises EVA.
- Não muda a janela de data do matching principal — evitamos regressão em outros bancos.

## Detalhes técnicos

- Arquivos: `src/components/lancamentos/ImportStatementModal.tsx`, `src/components/lancamentos/import/ReconcileStep.tsx`.
- Tolerância de valor: `AMOUNT_TOLERANCE = 0,05` (mesma já usada).
- Chave de agrupamento: `Math.round(Math.abs(amount) * 100)`.
- Guard: `Set<string>` de ids de órfãos já promovidos + flag "user touched" por linha para não desfazer edições manuais.
- Feito 100% no cliente, sem chamada extra ao banco.
