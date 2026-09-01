# Corrigir barras de rolagem duplicadas na tabela de Procedimentos

## Problema
Na rota `/precificacao` (`src/pages/Precificacao.tsx`), a tabela de procedimentos fica com **dois contêineres de rolagem aninhados**:

- Wrapper externo: `<div className="max-h-[288px] overflow-auto">` (linhas 119/134)
- Contêiner interno do `ProcedureTableV2`: `max-h-[360px] overflow-x-scroll overflow-y-auto`

Isso gera dois sintomas relatados:
1. **Duas barras verticais** — uma do wrapper externo, outra da tabela. A externa (maior) "mexe o cabeçalho" porque o `sticky top-0` só gruda no contêiner interno; ao rolar o externo, o bloco inteiro (com cabeçalho) sobe.
2. **Barra horizontal só aparece no final** — a barra horizontal do contêiner interno fica no fundo dos 360px, mas o viewport externo (288px) corta esse fundo; só aparece depois de rolar o externo até o fim.

A rota `/precificacao-v2` já está correta (sem wrapper externo).

## Solução
Unificar em um único contêiner de rolagem — o próprio `ProcedureTableV2` — em ambas as rotas.

### 1. `src/pages/Precificacao.tsx` (linhas 118–135)
Remover o wrapper `<div className="max-h-[288px] overflow-auto">…</div>` e deixar `ProcedureTableV2` diretamente dentro de `<CardContent>`, igual ao `PrecificacaoV2.tsx`.

Antes:
```jsx
<CardContent>
  <div className="max-h-[288px] overflow-auto">
    <ProcedureTableV2 ... />
  </div>
</CardContent>
```

Depois:
```jsx
<CardContent>
  <ProcedureTableV2 ... />
</CardContent>
```

### 2. `src/components/precificacao-v2/ProcedureTableV2.tsx` (linha 123)
Confirmar/manter o contêiner único já existente:
```jsx
<div className="relative w-full max-h-[360px] overflow-x-scroll overflow-y-auto">
```
- `overflow-y-auto` → rolagem vertical com `sticky top-0` no `<TableHeader>` (cabeçalho fixo ao rolar).
- `overflow-x-scroll` → barra horizontal **sempre visível** no fundo do viewport de 360px (não precisa descer).
- `max-h-[360px]` → ~5 linhas visíveis (cabeçalho 48px + 5×61px ≈ 353px).

## Resultado esperado
- Apenas uma barra vertical (a da tabela). Ao rolar verticalmente, o cabeçalho `Procedimento | Qtd | ... | Lucr./h` fica fixo.
- A barra horizontal aparece imediatamente no rodapé da área visível, sem precisar descer a tabela.
- Comportamento idêntico nas duas rotas `/precificacao` e `/precificacao-v2`.

## Validação
- Typecheck: `bunx tsgo --noEmit -p tsconfig.app.json`
- Smoke visual via Playwright na rota pública (sem login, só render de layout) se possível; a validação logada com dados reais fica a cargo do preview do usuário.
