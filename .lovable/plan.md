
## Objetivo

Manter os cards de **Apple Pay** e **Samsung Pay** na tela de Integrações, mas com texto honesto que explica a limitação técnica e orienta o usuário a usar **Open Finance (Pluggy/Itaú)** para capturar compras feitas via Apple Pay / Samsung Pay automaticamente.

## Contexto técnico (por que o texto precisa mudar)

Apple e Samsung **não expõem APIs públicas** para ler histórico de transações da carteira. Toda compra feita via Apple Pay / Samsung Pay passa pelo **cartão de crédito/débito real** cadastrado na carteira. Para capturar essas compras automaticamente no EVA, o usuário deve conectar o **cartão real** via Open Finance (Pluggy ou Itaú — ambos já integrados no projeto).

Prometer "sincronização do Apple Pay" induziria o usuário ao erro.

## Mudanças

### 1. `src/pages/Integracoes.tsx`

Atualizar as duas entradas adicionadas em `otherBanks`:

- **Apple Pay**
  - `description`: "Compras feitas via Apple Pay aparecem na fatura do cartão real. Conecte seu cartão via Open Finance (Pluggy) para captura automática."
  - Manter como card "Em breve" (sem ação funcional de conectar diretamente)

- **Samsung Pay**
  - `description`: "Compras feitas via Samsung Pay aparecem na fatura do cartão real. Conecte seu cartão via Open Finance (Pluggy) para captura automática."
  - Manter como card "Em breve"

### 2. Sem mudanças de backend

- Nenhuma migration
- Nenhuma edge function nova
- Nenhuma tabela nova
- Nenhum secret novo

## O que NÃO faremos (e por quê)

- ❌ **Não** vamos implementar "sincronização do Apple Pay" — Apple não oferece API para isso
- ❌ **Não** vamos remover os cards — o usuário quer manter visibilidade da marca
- ❌ **Não** vamos criar um fluxo de OAuth/Wallet — não existe esse fluxo do lado da Apple/Samsung para terceiros

## Próximos passos sugeridos (fora deste plano)

Se o objetivo é **realmente capturar compras automaticamente**, o caminho é reforçar a UX do **Pluggy** (Open Finance) — que já está implementado em `src/components/integracoes/PluggyConnectModal.tsx` e cobre exatamente esse caso quando o cartão real está conectado.
