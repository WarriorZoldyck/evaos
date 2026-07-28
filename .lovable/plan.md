## Diagnóstico

Confirmado no código:

- Em `ImportStatementModal.tsx` (linhas ~981 e ~1039), linhas sem match nascem com `matchActions[i] = "ignorar"`. Mas `explicitlyIgnored` fica vazio.
- Em `ReconcileStep.tsx` (linhas 1365-1370), com `willBeCreated=false` e `explicitlyIgnored.has(i)=false`, a linha exibe o badge vermelho **"Sem decisão — bloqueia o Importar"** e, no rodapé, o botão auxiliar mostra **"Desfazer ignorar"** (linha 1491) — como se o usuário já tivesse ignorado.
- `getRowDisposition` (linha 1458) marca a linha como `pending`, incrementa `counts.pendente > 0` e o botão Importar (linha 2596) fica desabilitado.
- O rótulo esquerdo do toggle é **"Editar"** (linha 1442), não "Ignorar", contradizendo o modelo mental do usuário.

Ou seja: o toggle já é a decisão que o usuário quer (off=ignorar, on=criar), mas o código trata "off" como "pendente" e ainda expõe um botão redundante "Ignorar de vez / Desfazer ignorar".

## Plano

### `src/components/lancamentos/import/ReconcileStep.tsx`

1. Trocar o rótulo esquerdo do toggle de **"Editar"** para **"Ignorar"** (linha ~1442). Manter "Criar" à direita. Ajustar `title`/`ariaLabel` para "Ligue para criar, desligue para ignorar esta linha".
2. Remover o botão auxiliar "Ignorar de vez / Desfazer ignorar" (linhas 1478-1492) — a decisão vive só no toggle.
3. Remover o badge **"Sem decisão — bloqueia o Importar"** (linhas 1365-1370). Estado OFF passa a exibir um badge neutro discreto **"Será ignorado"** (cinza) para deixar claro que a linha não será importada.
4. Manter o badge âmbar **"Rascunho — ative o toggle para criar"** apenas quando a linha estiver em `criar` porém ainda não `reviewed` (situação legada de sessão restaurada).
5. Toggle `onCheckedChange`:
   - `checked=true` → como hoje: confirma edição, seta ação `criar` e `reviewedRows`.
   - `checked=false` → seta ação `ignorar`, remove de `reviewedRows` e marca `explicitlyIgnored` (novo callback booleano). Ou seja, desligar é uma decisão consciente.
6. Estado visual da linha quando OFF: opacidade leve (`opacity-60`) na coluna de descrição/categoria para reforçar "esta linha não será importada", sem bloquear edição (se o usuário quiser editar antes de ligar).

### `src/components/lancamentos/ImportStatementModal.tsx`

1. No seeding inicial de `matchActions` (linhas ~972-984 e ~1034-1049): linhas sem match continuam nascendo como `"ignorar"`, e agora também são adicionadas a `explicitlyIgnored` desde o início (a posição padrão do toggle já É a decisão de ignorar).
2. Ao restaurar sessão persistida, aplicar a mesma regra: qualquer linha `matchActions[i] === "ignorar"` sem um `matchTarget` conta como `explicitlyIgnored`.
3. `getRowDisposition` (linha 1458): remover o retorno `"pending"`. OFF sempre resolve para `ignore-explicit`. `counts.pendente` deixa de existir como conceito de bloqueio.
4. Botão Importar (linha ~2596): remover a trava por `pendente > 0`. Continua bloqueado apenas por divergência não-confirmada (fluxo existente) e por `rows.length === 0`.
5. Toast de "Total pendente" (linha ~1492): remover, já não se aplica.
6. Ligar novos callbacks passados ao `ReconcileStep`: `onExplicitIgnore(i, true)` ao desligar o toggle.

### O que NÃO muda

- Divergência de totais (extrato vs. decisões) continua exigindo confirmação via botão "Total informado pelo banco".
- Fluxo de vincular (linhas com match) permanece intacto.
- Persistência de sessão (`localStorage`) permanece.

### Verificação

- Abrir importação, subir um extrato novo: todas as linhas novas nascem com toggle à esquerda (OFF/Ignorar), rótulo "Ignorar / Criar", sem badge vermelho, sem botão "Desfazer ignorar".
- Botão Importar habilita imediatamente (respeitando divergência).
- Ligar um toggle: linha vira "Confirmada" e conta como criação; total resolvido atualiza.
- Recarregar página: retomada mantém decisões e não regride para "sem decisão".
- `tsgo` limpo nos dois arquivos.
