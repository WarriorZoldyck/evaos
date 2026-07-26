## Diagnóstico

O toast aparece mas a linha "desaparece" sem mudar de seção porque `manualLinkedRows` — o grupo de linhas do extrato vinculadas manualmente a um órfão da seção "Só no sistema" — é computado mas **nunca renderizado**.

O que acontece hoje ao clicar "É o mesmo" em uma linha da subseção "Mesmo valor no extrato" (dentro de "Só no sistema"):

1. `handleMarkSame(i, o.id)` marca `action=vincular` e `matchTargets[i]=o.id`.
2. `manualLinkedIdxSet` passa a incluir `i` → `newRows` remove a linha → **some de "Só no extrato"**.
3. `linkedOrphans` recebe `o.id` → **card do órfão some de "Só no sistema"**.
4. `manualLinkedRows` cresce, mas **nenhuma UI o mostra** → parece "não aconteceu nada".
5. `renderMatchRow` também não serve: acessa `matches[i]!.best!.candidate`, que é `null` para essas linhas.

Nas outras duas origens do botão (seções "Correspondências prováveis" e "Provável"), a linha já está ou passa a ficar em `matchedExactRows`/`matchedToleranceRows`, então o botão é praticamente um no-op visual (a linha continua no mesmo lugar, agora como vincular).

## Mudanças

### `src/components/lancamentos/import/ReconcileStep.tsx`

**1. Mapa de órfãos por id**
Perto do `useMemo` de `categoriesById` (~linha 370):
```ts
const orphansById = useMemo(
  () => new Map(orphans.map((o) => [o.id, o])),
  [orphans],
);
```

**2. Novo renderer para linhas vinculadas manualmente**
Ao lado de `renderMatchRow` (~linha 533), adicionar `renderManualLinkRow({ r, i })` que:
- Resolve o alvo com `orphansById.get(matchTargets[i])`.
- Renderiza o mesmo layout de duas colunas (Extrato ↔ EVA) usado por `renderMatchRow`, mas lendo dos dados do órfão em vez de `matches[i].best.candidate`.
- Mostra um badge `Vinculado manualmente` (ícone `Link2`, cor sky) para diferenciar.
- Botão "Desfazer" que chama `onActionChange(i, "criar")`, limpa `matchTargets[i]` e remove `o.id` de `linkedOrphans` — devolve a linha ao extrato e o órfão à lista.

**3. Render da lista dentro da seção "Correspondências prováveis"**
Logo depois do bloco de `matchedToleranceRows` (~linha 905), incluir:
```tsx
{manualLinkedRows.length > 0 && (
  <div className="border rounded-lg divide-y bg-background mt-2">
    <header className="px-3 py-2 text-xs font-semibold flex items-center gap-2 text-sky-700 bg-sky-500/5 border-b">
      <Link2 className="h-3.5 w-3.5" /> Vinculadas manualmente
      <Badge variant="secondary" className="text-[10px]">{manualLinkedRows.length}</Badge>
    </header>
    {manualLinkedRows.map(renderManualLinkRow)}
  </div>
)}
```
Isso dá ao usuário o feedback visual: a linha sai do extrato/órfão e aparece confirmada na área de conciliadas.

**4. Contadores de cobertura**
Incluir `manualLinkedRows.length` em `coverageMatched` e `systemCount` (fora do card mode com `systemBill`), para que o resumo/percentual reflita a linha recém-vinculada.

## Fora do escopo
- Handler do submit em `ImportStatementModal` (já processa `vincular` + `matchTargets` corretamente).
- Fluxos das seções "Correspondências prováveis" e "Provável" (comportamento já era funcional; toast atual serve como confirmação).
- Toggle "Criar/Ignorar", `ReviewNewEntryModal`, sidebar, design system.

## Verificação
- Em "Só no sistema", clicar "É o mesmo" em uma linha do extrato de mesmo valor:
  - Toast confirma.
  - Card do órfão some.
  - Linha some de "Só no extrato".
  - **Aparece um novo bloco "Vinculadas manualmente"** com as duas pontas (extrato ↔ EVA) e badge azul.
  - Contadores de conciliar/cobertura aumentam.
- Botão "Desfazer" na linha vinculada retorna a linha ao extrato e o órfão à lista original.
- Nas seções "Correspondências prováveis"/"Provável", o comportamento continua igual (toast + status vincular já implícito).
