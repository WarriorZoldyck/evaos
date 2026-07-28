## Diagnóstico

1. **Ocupa muito espaço.** Hoje, sempre que `hasDivergence` é true, o rodapé (`ImportStatementModal.tsx:2453-2469`) renderiza um bloco vermelho grande com título, descrição e checkbox — visível durante toda a conciliação. Isso empurra o botão de importar para fora da tela em telas pequenas (visto no screenshot).
2. **"Entendi a divergência" parece não habilitar.** O botão Importar está desabilitado por três condições combinadas (`disabled={importing || blockedByDivergence || counts.pendente > 0}`). No cenário atual há **133 linhas "sem decisão"** — `counts.pendente > 0` continua bloqueando o botão mesmo depois de marcar o acknowledge. Do ponto de vista do usuário, parece que o checkbox não funcionou; na verdade é outra trava agindo em paralelo, sem sinalização clara de que existem dois bloqueios diferentes.

## Objetivo

- Durante a conciliação, mostrar a divergência apenas como uma linha compacta (uma frase colorida no bloco de totais que já existe). Nenhum painel grande.
- Só abrir o alerta detalhado + "Entendi a divergência" quando o usuário clicar em **Importar** e houver divergência — via `AlertDialog` de confirmação.
- Deixar explícito no rodapé que "sem decisão" é uma trava separada; enquanto houver linhas sem decisão o botão continua bloqueado (correto — extrato é a fonte da verdade), e nem chega a abrir o diálogo de divergência.

## Alterações

### `src/components/lancamentos/ImportStatementModal.tsx` (bloco do rodapé, ~2340-2500)

1. **Remover** o painel `hasDivergence && (<div className="rounded border border-destructive/40 …">…</div>)` (2453-2469). Manter apenas a linha compacta existente (2442-2452) que já mostra "⚠ Divergência: R$ X (esperado R$ Y)".
2. **Não usar mais `blockedByDivergence` no `disabled` do botão.** O botão Importar passa a ser desabilitado somente por `importing || counts.pendente > 0`. Se a única trava for a divergência, o botão fica clicável e a confirmação acontece no diálogo.
3. **Novo estado** `const [confirmDivergenceOpen, setConfirmDivergenceOpen] = useState(false)` perto dos demais estados do wizard.
4. **Novo handler** `handleImportClick`:
   - Se `hasDivergence && !acknowledgeDivergence` → `setConfirmDivergenceOpen(true)` e retorna.
   - Caso contrário → chama `handleImport()` diretamente.
   O `onClick` do botão passa a ser `handleImportClick`.
5. **Novo `AlertDialog`** renderizado dentro do wizard (após o rodapé), controlado por `confirmDivergenceOpen`:
   - Título: "A importação não bate com o valor da fatura".
   - Corpo: mesmo texto que hoje está inline (revisar duplicados, IOF internacional, anuidades, cartões adicionais) + linha com "Diferença: {fmt(diff)} — esperado {fmt(userStatementTotal)}".
   - Ações:
     - `Cancel`: fecha o diálogo, não muda estado.
     - `Action` "Importar mesmo assim": faz `setAcknowledgeDivergence(true); setConfirmDivergenceOpen(false); handleImport();`.
6. **Resetar** `acknowledgeDivergence` para `false` sempre que o `statementTotalInput` ou `rows` mudarem de forma que reavaliem a divergência (já é resetado no `onChange` do input em 2405; manter).
7. **Sem mudanças de props ou de fluxo de sessão** — o `acknowledgeDivergence` continua sendo persistido no snapshot.

## Fora de escopo

- Mudar a lógica de contagem de "sem decisão" — continua obrigatória por padrão do fluxo.
- Alterar o cálculo de divergência (>R$ 1,00 continua o gatilho).
- Qualquer outra tela.

## Verificação

1. Abrir uma importação com divergência: o rodapé mostra só a linha "⚠ Divergência: -R$ X"; nenhum painel grande.
2. Com `counts.pendente > 0`: botão Importar segue desabilitado e o aviso âmbar de "sem decisão" continua visível — como hoje.
3. Zerar as pendências e clicar Importar com divergência: abre o `AlertDialog`; ao confirmar, importa. Ao cancelar, volta ao rodapé sem alterar nada.
4. Sem divergência: clicar Importar segue direto, sem diálogo.
