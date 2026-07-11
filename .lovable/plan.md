
## Objetivo

Quando o usuário entra pela primeira vez, o contexto **Pessoal** já vem selecionado. A partir daí, qualquer alteração que ele fizer (trocar contexto, marcar/desmarcar empresas, ativar "Todas as contas") fica salva e é restaurada ao recarregar a página, navegar entre páginas ou aplicar filtros de data.

## Como funciona hoje

Em `src/contexts/CompanyContext.tsx`, o estado do seletor unificado vive só em memória:

- `viewAll` inicia em `true` (mostra "Todas as contas")
- `personalSelected` inicia em `true`
- `selectedCompanyIds` inicia em `[]`
- `selectedCompanyId` inicia em `null`

Sempre que o `effectiveUserId` muda (login, troca de impersonation), esses valores voltam ao default. Como nada é persistido, um F5 ou uma troca de página que recrie o provider zera a seleção.

## Mudanças propostas

### 1. `src/contexts/CompanyContext.tsx` — persistir seleção por usuário

- Definir uma chave por usuário: `eva:company-selection:{effectiveUserId}` no `localStorage`.
- Formato salvo (JSON):
  ```json
  {
    "viewAll": false,
    "personalSelected": true,
    "selectedCompanyIds": ["uuid-1", "uuid-2"],
    "selectedCompanyId": "uuid-1"
  }
  ```
- No `useEffect` que dispara com `effectiveUserId`:
  1. Buscar empresas (como já faz).
  2. Ler `localStorage[chave]`.
     - **Se existir e for válido** (ids ainda existem em `companies` — filtrar os que sumiram): hidratar `viewAll`, `personalSelected`, `selectedCompanyIds`, `selectedCompanyId`.
     - **Se não existir** (primeiro acesso desse usuário): aplicar default **Pessoal selecionado**, ou seja:
       - `viewAll = false`
       - `personalSelected = true`
       - `selectedCompanyIds = []`
       - `selectedCompanyId = null` (isPersonal = true)
     - Persistir esse default imediatamente para virar o "estado salvo".
- Adicionar um `useEffect` que, sempre que `viewAll`, `personalSelected`, `selectedCompanyIds` ou `selectedCompanyId` mudarem (e já houver `effectiveUserId`), grava o objeto atualizado no `localStorage`.
- Cuidados:
  - Envolver leitura/escrita em `try/catch` (modo privado, storage cheio).
  - Validar ids contra a lista carregada de `companies` para não restaurar um id de empresa apagada.
  - Não persistir enquanto `loading` ainda estiver `true` na primeira carga (evita sobrescrever o valor salvo com o default antes da hidratação).

### 2. Comportamento esperado após a mudança

- **Primeiro login:** contexto abre em Pessoal.
- **Usuário troca para uma empresa / marca várias / ativa "Todas as contas":** seleção fica salva.
- **F5, trocar de página, aplicar filtro de data no Dashboard:** o `CompanyProvider` continua vivo dentro do `AppLayout`, mas mesmo em recarga completa a hidratação a partir do `localStorage` devolve exatamente o último estado.
- **Trocar de conta / impersonar outro dono no Hub:** carrega a seleção salva daquele `effectiveUserId`, ou cai no default Pessoal se for a primeira vez.
- **Logout:** a chave permanece salva para o próximo login desse usuário (não precisa limpar).

## Fora do escopo

- Não mexer em `Dashboard.tsx`, filtros de data, hooks de dados, `applyCompanyFilter` ou qualquer outra página. A persistência é 100% dentro do `CompanyContext`, então todo o resto do app herda o comportamento automaticamente.
- Não sincronizar entre abas nem salvar no Supabase — `localStorage` local basta para o caso descrito.
