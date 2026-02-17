

## Botao global de Novo Lancamento como modal direto + limpeza de contexto

### Resumo das alteracoes

1. **Esconder botao "Novo Lancamento" do header quando estiver em /lancamentos** (ja tem o proprio botao na pagina)
2. **Abrir o modal diretamente de qualquer pagina** sem redirecionar para /lancamentos — renderizar o `TransactionFormModal` no `AppLayout`
3. **Remover o seletor de contexto do header da pagina Lancamentos** (fica apenas no menu lateral e no modal)
4. **Garantir que o modal use seu proprio contexto interno** (`formCompanyId`) independente da pagina

### Detalhes tecnicos

**`src/components/layout/AppLayout.tsx`**

- Condicionar o botao "Novo Lancamento" para aparecer somente quando `location.pathname !== "/lancamentos"`
- Adicionar estado local `formOpen` para controlar o modal
- Renderizar `TransactionFormModal` diretamente no layout (precisa buscar os dados necessarios)
- Criar um novo hook leve ou reutilizar dados existentes para alimentar o modal (bankAccounts, categories, etc.)
- Como o modal precisa de muitos dados (contas, categorias, cartoes, etc.), a melhor abordagem e criar um componente wrapper `GlobalTransactionModal` que internamente usa os hooks necessarios

**Novo componente: `src/components/layout/GlobalTransactionModal.tsx`**

Componente que:
- Recebe apenas `open` e `onClose`
- Internamente usa `useTransactions` (ou queries diretas mais leves) para buscar bankAccounts, creditCards, wallets, suppliers, clients, categories, cardTerminals, allAccounts
- Renderiza o `TransactionFormModal` com todos os dados
- Ao salvar com sucesso, dispara um evento customizado para que a pagina de Lancamentos (se estiver aberta) atualize sua lista

**`src/pages/Lancamentos.tsx`**

- Remover o bloco do `DropdownMenu` de contexto (Pessoal/Empresa) do header da pagina (linhas 178-206)
- Remover imports relacionados: `useCompany`, `User`, `Building2`, `ChevronDown`, `DropdownMenu*`
- Manter o botao "Novo Lancamento" proprio da pagina (que abre o modal local)

**`src/components/layout/AppLayout.tsx` (atualizacao)**

- Importar e renderizar `GlobalTransactionModal`
- O botao do header chama `setGlobalFormOpen(true)` em vez de navegar
- Remover `useNavigate` e a logica de `navigate("/lancamentos?new=true")`
- Manter o evento customizado `open-new-transaction` para quando estiver na pagina de lancamentos (nao sera mais necessario pois o botao nao aparece la)

### Fluxo resultante

```text
Pagina de Lancamentos:
  Header: [titulo] [contagem]  ............  [Novo Lancamento]
  (sem seletor de contexto no header — usa o do sidebar)
  (modal abre localmente com dados ja carregados)

Qualquer outra pagina:
  Header global: [sidebar trigger] ...... [Novo Lancamento] [theme]
  (clique abre modal diretamente, sem redirecionar)
  (modal carrega seus proprios dados via GlobalTransactionModal)
```

### Arquivos

- **Criar**: `src/components/layout/GlobalTransactionModal.tsx`
- **Modificar**: `src/components/layout/AppLayout.tsx`
- **Modificar**: `src/pages/Lancamentos.tsx`

