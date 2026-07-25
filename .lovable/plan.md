## Ajustes na tela de Importar Extrato (a partir do vídeo)

Três ajustes pontuais, todos em UI/UX + cálculo de total. Sem mudanças de backend.

### 1. Um único botão "Cancelar importação", fixo no rodapé

Hoje existem dois botões: um no cabeçalho superior (`src/pages/ImportarExtrato.tsx`) e o "Voltar/Cancelar" do rodapé do modal. O usuário reportou que o de cima não responde ao hover e é redundante.

- Remover o botão "Cancelar importação" do cabeçalho superior em `ImportarExtrato.tsx` (mantendo só o ESC e a navegação por rota).
- No rodapé de `ImportStatementModal.tsx` (variant `page`), garantir que o rodapé fica **sticky no bottom** durante **todas as etapas** (upload, preview, reconcile) — não só na última.
- Colocar **"Cancelar importação"** no canto **esquerdo** do rodapé (variant `ghost`, ícone X) em todas as etapas. Ele chama o mesmo `onClose` que hoje volta para `/lancamentos` com a animação de slide.
- O botão de avançar ("Próximo…" / "Importar N transações") continua no canto direito, como está.
- Na etapa `reconcile`, o botão "Voltar" atual passa a conviver com o "Cancelar importação" (Cancelar à esquerda, Voltar ao lado, ações principais à direita).

### 2. "Criar no sistema" vira ação por linha (com feedback imediato)

Hoje "Criar no sistema" é apenas o **estado padrão** da linha — clicar não faz nada visível, o que o usuário lê como botão quebrado. A criação só acontece no "Importar N…" do rodapé.

Mudança de comportamento na coluna "Ação" da seção "Só no extrato" em `ReconcileStep.tsx`:

- Clicar em **"Criar no sistema"** passa a **criar aquele lançamento imediatamente** (chamando o mesmo caminho de `createMultipleTransactions` usado pelo import em lote, mas com uma única linha).
- Enquanto processa: botão mostra spinner + fica `disabled`.
- Ao concluir: a linha sai da tabela "Só no extrato" com um fade curto e entra numa nova seção compacta **"Criados nesta sessão (N)"** logo abaixo do cabeçalho, com link "Desfazer" (últimos 30s) que apaga o lançamento recém-criado.
- Os contadores do rodapé (`criar` / total) descontam a linha criada; o botão final passa a dizer "Importar N transações restantes" e ignora as linhas já criadas.
- Se falhar: toast de erro e a linha permanece na lista, sem mudança de estado.
- **"Manter só do extrato"** continua como está (marca `ignorar`, aplicado no import final) — é a única ação que ainda depende do commit do rodapé.
- Tooltip do "Criar no sistema" muda para: _"Criar este lançamento agora no sistema."_

Motivo: alinha o comportamento à expectativa demonstrada no vídeo ("clico e nada acontece") e mantém coerência com "Manter só do extrato" ser uma marcação, não uma ação imediata.

### 3. "Extrato original" mostrando valor errado (~R$ 21.038,94 vs R$ 20.739,08 real)

Hoje, em `ReconcileStep.tsx` linha 231:

```ts
const statementTotal = indexed.reduce((s, { r }) => s + Math.abs(r.amount), 0);
```

Isso soma **valores absolutos** de todas as linhas selecionadas. Para fatura de cartão, os estornos/pagamentos (receitas) precisam **subtrair** do total — é exatamente por isso que o rodapé (que usa valor sinalizado) mostra R$ 20.739,08 e o topo mostra R$ 21.038,94.

Correção mínima:

- Substituir por soma **sinalizada** (despesa positiva, receita negativa) e mostrar o `Math.abs` do resultado — ficando idêntico ao `grandTotal`/`importedAbs` do rodapé.
- Aplicar a mesma correção em `remainingTotal` e no cálculo de `reconciledRowsTotal` para manter a barra de progresso coerente.
- Manter tolerância de ±R$ 0,05 no comparador `totalsDivergent` (a diferença de "dois centavos da Apple" que o usuário mencionou continua absorvida).

Resultado esperado: "Extrato original", "Restante" e o total do rodapé passam a bater no mesmo número (R$ 20.739,08 no caso do vídeo).

### Fora do escopo

- Não vou mexer no parser (`parse-bank-statement`) — o problema é de agregação na UI, não de extração.
- Não vou alterar o fluxo de matching nem a lógica de "É o mesmo".
- Se preferir que "Criar no sistema" continue como marcação (mantendo commit em lote) e a mudança fique só em copy/UX, me diga que reverto o ponto 2 para um ajuste puramente visual.
