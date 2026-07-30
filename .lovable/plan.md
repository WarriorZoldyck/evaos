## Objetivo

O campo **Cliente/Fornecedor** na tela de conciliação hoje é um `Select` simples: com centenas de contatos vira uma lista rolável sem busca. Vamos deixá-lo igual ao seletor de categoria — popover com barra de busca, lista virtualizada e "Criar novo" a partir do que foi digitado.

## O que muda

Arquivo: `src/components/lancamentos/ContactSelectWithCreate.tsx` (reescrita interna do componente, **sem mudar as props**, então `ReconcileStep` e `TransactionFormModal` continuam funcionando sem alteração).

Nova estrutura, espelhando `CategoryCascadeSelect`:

1. **Trigger** — botão no mesmo estilo do gatilho de categoria (texto do contato selecionado ou placeholder, ícone `ChevronsUpDown`, borda pontilhada quando vazio, para casar com o visual atual da tabela).
2. **Popover + Command** — `CommandInput` com placeholder "Buscar cliente..." / "Buscar fornecedor...", foco automático ao abrir.
3. **Busca sem acento** — mesma função `normalize` (NFD + remoção de diacríticos) usada em categoria, com filtro controlado e o filtro interno do `cmdk` desligado (`shouldFilter={false}`), como já é feito lá.
4. **Lista virtualizada** — reutiliza `VirtualCommandList` (o mesmo componente da categoria) para manter o seletor fluido com muitos contatos.
5. **Item "— limpar —"** no topo, igual ao de categoria, para desvincular o contato da linha.
6. **"Criar novo"** — sempre visível no rodapé da lista; quando há texto digitado, mostra `Criar "GUILHERME GALDINI"` e já abre o diálogo com o nome pré-preenchido (mantém a correção anterior de criar exatamente o que o usuário digitou, não a descrição do extrato).
7. **Estado vazio** — `CommandEmpty` com "Nenhum contato encontrado" + atalho de criação.

A lógica de criação no Supabase (`suppliers`/`clients`, `effectiveUserId`, toast, `localExtras`, callback `onContactCreated`) permanece exatamente como está.

## Detalhes técnicos

- Props mantidas: `contacts`, `value`, `onChange`, `placeholder`, `type`, `onContactCreated`, `disabled`.
- `value` continua sendo o `id` do contato; `onChange("")` no "limpar".
- Popover com `align="start"` e largura mínima do gatilho, para não estourar o layout apertado da tabela de conciliação.
- Sem migração e sem mudança de dados — é só UI.

## Verificação

- Typecheck do projeto.
- Conferir na conciliação: abrir o campo, digitar parte de um nome com acento (ex.: "simoes"/"simões"), selecionar, limpar e criar um contato novo a partir da busca.
