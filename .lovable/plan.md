# Clarear ações da seção "Só no extrato"

## Contexto

Hoje, na tela de importação de extrato, a seção **"Só no extrato — o que fazer?"** já cria cada linha como novo lançamento por padrão (`matchAction = "criar"`). O único botão visível na coluna "Ação" é **"Manter só do extrato"**, que na verdade é a alternativa (ignorar). Isso faz o usuário achar que a linha não será importada, quando ela **será** — basta escolher categoria e clicar em "Importar N lançamentos" no rodapé.

Não há bug de lógica. É um problema de UI/copy: a ação padrão ("criar no sistema") está invisível.

## Escopo

Apenas UI e textos em `src/components/lancamentos/import/ReconcileStep.tsx`. Nenhuma mudança em matching, categorização ou persistência.

## Mudanças

### 1. Coluna "Ação" da seção "Só no extrato"

Substituir o botão único por um toggle de dois estados, seguindo o mesmo padrão visual já usado na seção de conciliação:

```text
[ ✓ Criar no sistema ]   [ Manter só do extrato ]
    (padrão, destacado)      (alternativa)
```

- **Criar no sistema** → `onActionChange(i, "criar")` (estado atual default).
- **Manter só do extrato** → `onActionChange(i, "ignorar")` (comportamento atual do botão único).
- Estilo do botão ativo igual ao já usado nos demais toggles do arquivo (fundo sólido + ícone).

### 2. Tooltip do botão "Manter só do extrato"

Trocar o texto atual por:

> "Não criar este lançamento no sistema. A linha fica só no extrato importado e vai para 'Ignorados' — pode ser restaurada depois."

### 3. Micro-copy do cabeçalho da seção

No bloco informativo azul acima da tabela (L820-825 aprox.), adicionar uma frase:

> "Por padrão, cada linha vira um novo lançamento no sistema com a categoria escolhida abaixo. Use **'Manter só do extrato'** para pular linhas que você não quer importar."

## Fora de escopo

- Alterar lógica de matching, auto-pareamento por valor, ou contadores do rodapé.
- Mudar comportamento das outras seções ("Igual", "Quase igual", "Só no sistema").
- Criar nova ação além de `criar` / `ignorar`.
