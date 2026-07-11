## Causa raiz

O cabeçalho do Dashboard usa `position: sticky`, mas ele está dentro do container `<div className="flex-1 overflow-auto p-4 md:p-6">` do `AppLayout`. Esse container **nunca chega a rolar** porque o wrapper externo usa `min-h-screen` (sem altura máxima). Assim, quando o conteúdo cresce, quem rola é a **janela**, não o container interno.

Como `position: sticky` se ancora no ancestral de rolagem mais próximo (o `overflow-auto`), e esse ancestral não rola, o elemento "sticky" acompanha o scroll da página normalmente e some do topo — exatamente o que você viu.

O header global (`Novo Lançamento` / tema) parece fixo porque também é `sticky top-0`, mas ele está fora do container `overflow-auto` e acaba grudando na viewport da janela.

## Correção

### 1) `src/components/layout/AppLayout.tsx`
Fazer o container interno rolar em vez da janela:

- Trocar `min-h-screen` por `h-screen` no wrapper raiz.
- Adicionar `overflow-hidden` no `<main>` para que só o `<div className="flex-1 overflow-auto ...">` role.

Com isso, o `overflow-auto` passa a ser realmente um ancestral de rolagem e o `position: sticky` do Dashboard funciona.

### 2) `src/pages/Dashboard.tsx`
Simplificar o cabeçalho fixo agora que o container correto rola:

- Voltar para `sticky top-0` (remover os `-top-4 md:-top-6` e `-mt-4 md:-mt-6` que eu tinha colocado como workaround).
- Manter `-mx-4 md:-mx-6 px-4 md:px-6` para o header ocupar toda a largura do container (cobrindo o padding lateral).
- Manter fundo `bg-background/95 backdrop-blur-md` + `border-b` para leitura confortável quando houver conteúdo passando por baixo.
- `z-30` (abaixo do header global `z-40`, acima do conteúdo).

### 3) Verificação
Após a mudança, ao rolar o Dashboard:
- Título "Dashboard", seletor de conta e `PeriodFilter` permanecem visíveis no topo.
- O header global (logo/tema/Novo Lançamento) continua acima deles.
- `FinancialHealthBar`, cards e demais seções passam por baixo do cabeçalho.

## Fora do escopo
- Redesign dos cards.
- Tornar a `FinancialHealthBar` também fixa (podemos avaliar depois se quiser).
- Alterar comportamento de scroll de outras páginas (a mudança em `AppLayout` beneficia todas, sem quebrar layout — só passam a rolar no container interno).