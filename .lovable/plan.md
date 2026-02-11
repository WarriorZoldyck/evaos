
## Criar Categorias Inline no Modal de Lancamentos + Filtro por Contexto

### Problema 1: Categorias misturadas
Atualmente, as categorias sao carregadas no `useTransactions` usando o `companyFilter` do contexto global (sidebar). Porem, dentro do modal de lancamentos, o usuario pode trocar o contexto (Pessoal vs Empresa) via o seletor interno. Quando troca, as categorias nao acompanham -- continuam mostrando as do contexto anterior.

### Problema 2: Sem opcao de criar categoria no modal
O usuario precisa sair do modal, ir ate a pagina de Categorias, criar la, e voltar. Falta um botao "Criar Nova" dentro dos selects de categoria, subcategoria e sub-subcategoria.

---

### Solucao

#### 1. Filtrar categorias pelo contexto do formulario

No `TransactionFormModal`, em vez de usar as `categories` vindas do `useTransactions` (filtradas pelo contexto global), filtrar localmente pelo `formCompanyId`:

- Adicionar um estado local de categorias no modal
- Buscar categorias do Supabase quando `formCompanyId` mudar (pessoal = `company_id IS NULL`, empresa = `company_id = X`)
- Usar essas categorias locais para popular os selects de categoria/subcategoria/sub-subcategoria

#### 2. Botao "Criar Nova" nos selects de categoria

Adicionar em cada nivel de categoria (categoria, subcategoria, sub-subcategoria) um botao/item especial no dropdown que abre um mini-dialog inline para criar a categoria:

- Campo de nome
- Tipo herdado do pai (ou selecionavel no nivel raiz)
- `parent_id` automatico conforme o nivel
- Apos criar, recarregar a lista de categorias e selecionar a nova automaticamente

#### 3. Componente reutilizavel

Criar um componente `CategorySelectWithCreate` que encapsula:
- O Select com as opcoes existentes
- Um item "+ Criar nova" no final da lista
- Um mini-dialog/popover para o formulario de criacao rapida
- Callback para atualizar o form apos criacao

---

### Detalhes Tecnicos

**Arquivos modificados:**

1. **`src/components/lancamentos/TransactionFormModal.tsx`**
   - Adicionar estado `formCategories` com fetch proprio baseado em `formCompanyId`
   - Substituir os 3 selects de categoria pelo novo componente `CategorySelectWithCreate`
   - Passar `formCompanyId` e callback de refresh

2. **Novo: `src/components/lancamentos/CategorySelectWithCreate.tsx`**
   - Props: `categories`, `value`, `onChange`, `placeholder`, `parentId?`, `formCompanyId`, `activeTab`, `onCategoryCreated`
   - Renderiza um Select com as categorias + item "+ Criar nova"
   - Ao clicar em "+ Criar nova", abre um Dialog com campo de nome
   - Insere no Supabase com `user_id`, `company_id`, `parent_id`, `type`
   - Chama `onCategoryCreated()` para refetch e auto-seleciona a nova

3. **`src/components/lancamentos/TransactionFormModal.tsx` (MainFormContent)**
   - Receber `formCompanyId` como prop
   - useEffect para buscar categorias quando `formCompanyId` muda
   - Substituir os blocos de FormField de categoria/subcategoria/sub-subcategoria pelo novo componente

**Fluxo de dados:**
```text
formCompanyId muda
  -> fetch categories WHERE company_id = X (ou IS NULL)
  -> popula rootCategories, subCategories, subSubCategories
  -> cada select tem opcao "+ Criar nova"
  -> ao criar, insert no Supabase + refetch + auto-select
```
