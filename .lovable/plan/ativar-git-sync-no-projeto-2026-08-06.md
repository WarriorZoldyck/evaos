# Ativar Git Sync no projeto

## Objetivo
Conectar este projeto Lovable a um repositório GitHub para backup, versionamento e edição do código fora do editor Lovable.

## O que será feito
Esta integração é ativada pela interface do Lovable editor e não por código. O fluxo é:

1. Abrir o menu **Plus (+)** no canto inferior esquerdo do chat.
2. Selecionar **GitHub → Connect project**.
3. Autorizar o **Lovable GitHub App** na conta GitHub desejada.
4. Escolher a conta ou organização onde o repositório será criado.
5. Clicar em **Create Repository** no Lovable para criar o repo com o código atual do projeto.

## Resultado esperado
- Repositório GitHub criado com o código-fonte do projeto.
- Sincronização bidirecional: alterações no Lovable sobem automaticamente para o GitHub e alterações no GitHub sincronizam de volta para o Lovable.
- Possibilidade de clonar o repo localmente e editar com a ferramenta de preferência.

## Observações
- Apenas uma conta GitHub pode estar conectada por vez na conta Lovable.
- O Lovable não suporta importar repositórios existentes diretamente; neste caso, o repositório será criado do zero com o estado atual do projeto.
- Variáveis de ambiente e dados do banco não são sincronizados pelo GitHub; dados do banco devem ser exportados separadamente via Cloud → Advanced settings → Export data.

## Próximos passos
Após aprovar este plano, o usuário deverá seguir os passos acima na interface do Lovable editor. Não há alteração de código neste plano.
