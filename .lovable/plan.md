

# Edição de Perfil Pessoal e Empresas

## Problema
Atualmente a página de Configurações só exibe o email do usuário (sem edição) e as empresas só podem ser criadas ou excluídas — não há opção de editar.

## Solução

### 1. Card "Preferências" — Editar perfil pessoal
Transformar o card estático em um formulário editável com os campos da tabela `profiles`:
- **Nome completo** (`full_name`)
- **CPF** (`cpf`)
- **WhatsApp** (`whatsapp_number`)
- Email (somente leitura)

Ao abrir a página, carregar os dados do perfil via `supabase.from("profiles").select().eq("id", user.id).single()`. Botão "Salvar" faz `update` na tabela `profiles`.

### 2. Card "Empresas" — Botão de editar em cada empresa
Adicionar um botão de edição (ícone Pencil) ao lado do botão de excluir em cada empresa listada. Ao clicar:
- Preencher o mesmo formulário inline (que já existe para criar) com os dados da empresa selecionada
- Trocar o botão de "Cadastrar" para "Salvar alterações"
- Usar `supabase.from("companies").update({ name, cnpj }).eq("id", editingId)` ao salvar

### Arquivos alterados

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Configuracoes.tsx` | Adicionar state para perfil (`fullName`, `cpf`, `whatsappNumber`), fetch no mount, form editável no card Preferências. Adicionar state `editingCompanyId`, botão Pencil nas empresas, lógica de update. |

Nenhuma migration necessária — as tabelas `profiles` e `companies` já possuem todos os campos.

