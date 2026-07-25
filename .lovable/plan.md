# Importar Extrato como página deslizante

Trocar o modal atual de importação por uma **rota dedicada** (`/lancamentos/importar-extrato`) que entra com animação de slide horizontal, como se o usuário navegasse para uma nova página dentro do EVA. Sem popup, sem overlay escuro — a tela atual desliza para a esquerda e a de importação entra pela direita, ocupando toda a área de conteúdo (mantendo sidebar e header globais).

## O que muda

1. **Nova rota** `/lancamentos/importar-extrato` registrada em `src/App.tsx` dentro do `AppLayout`, para preservar sidebar + header globais (contexto Pessoal/Empresa, avatar, etc).
2. **Novo componente de página** `src/pages/ImportarExtrato.tsx` que:
   - Reaproveita **100% do conteúdo interno atual** do `ImportStatementModal` (etapas Configurar → Reconciliar → Categorizar). Nenhuma lógica de matching, reconciliação ou categorização muda.
   - Renderiza o conteúdo em uma página cheia (sem `Dialog`, sem overlay), com header próprio ("Importar Extrato Bancário" + botão fechar).
   - Ao concluir ou cancelar, navega de volta para `/lancamentos` (também com slide, no sentido inverso).
3. **Refator do modal existente** (`ImportStatementModal.tsx`): extrair o miolo (etapas + estados) para um componente reutilizável `ImportStatementFlow`, consumido tanto pela nova página quanto — se necessário — por qualquer chamada legada. Preferência: aposentar o modal e apontar tudo para a rota.
4. **Trigger do botão** em `src/pages/Lancamentos.tsx`: o botão "Importar Extrato" no header global passa a chamar `navigate('/lancamentos/importar-extrato')` em vez de abrir o modal. Mesma coisa para o banner "Experimentar agora" e para o CTA no card de novidade.
5. **Animação de slide** implementada com uma transição CSS simples baseada em rota:
   - Wrapper na rota nova com `animate-slide-in-right` (já existe em `tailwind.config.ts`).
   - Ao sair, aplicar `animate-slide-out-right` invertido — usando estado local no componente de página que, ao fechar, dispara a animação e depois faz `navigate(-1)`. Sem dependência nova (sem framer-motion).
6. **Preservação de estado**: como agora é rota, o estado do fluxo vive no componente de página. Se o usuário sair no meio, perde o progresso — mesmo comportamento do modal hoje. Sem persistência adicional.

## Fora do escopo

- Nenhuma mudança na lógica de matching, reconciliação por valor, categorização histórica ou copy da tela.
- Nenhuma mudança em outros modais do sistema.
- Sem alteração no fluxo do WhatsApp.

## Detalhes técnicos

- **Roteamento**: adicionar `<Route path="importar-extrato" element={<ImportarExtrato/>} />` como filha aninhada da rota que já usa `AppLayout` em `src/App.tsx` (verificar estrutura atual — se `Lancamentos` for `/lancamentos`, a nova fica `/lancamentos/importar-extrato`).
- **Refator**: mover JSX do `DialogContent` de `ImportStatementModal.tsx` para `ImportStatementFlow.tsx` (novo). Props: `onClose`, `onImport`, `bankAccounts`, `wallets`, `creditCards`, `allBankAccounts`, `companies`, `categories`, `allCategories`, `refetchAccounts` (mesmas do modal). O componente de página passa esses dados usando os mesmos hooks que `Lancamentos.tsx` já usa (`useTransactions`).
- **Animação**: container raiz da página com `className="animate-slide-in-right"`; estado `closing` que aplica classe `translate-x-full transition-transform duration-300`, e `setTimeout(() => navigate('/lancamentos'), 300)`.
- **Botão do header em `Lancamentos.tsx`**: trocar `onClick={() => setImportOpen(true)}` por `onClick={() => navigate('/lancamentos/importar-extrato')}`. Remover `<ImportStatementModal>` renderizado ao final do componente (e o estado `importOpen`), já que o fluxo agora vive na rota. O banner "Experimentar agora" também passa a navegar.
- **Fechar**: botão X no header da página + tecla ESC → dispara `closing` → volta para `/lancamentos`.
