## Objetivo
Fazer a primeira integração bancária funcionar de ponta a ponta, priorizando Itaú, com fallback claro via Pluggy se o certificado Itaú continuar bloqueando o fluxo.

## Próximos passos recomendados

1. **Diagnóstico do certificado Itaú**
   - Revisar o fluxo atual de conexão Itaú, edge functions e tabela `itau_integrations`.
   - Identificar exatamente onde a sincronização para: upload/salvamento do certificado, autenticação no Itaú, token, consulta de extrato ou gravação dos lançamentos.
   - Validar se falta secret/configuração do Itaú ou se o certificado precisa estar em formato específico, como `.pfx/.p12`, senha e mTLS.

2. **Fechar o caminho técnico do Itaú**
   - Ajustar o backend para usar o certificado corretamente na chamada à API Itaú.
   - Melhorar mensagens de erro para dizer se o problema é certificado inválido, senha errada, credencial ausente, permissão da API ou ausência de contas retornadas.
   - Garantir que a integração grave status, última sincronização e erro legível para aparecer na tela.

3. **Sincronização de conta até lançamentos**
   - Confirmar que a conta Itaú conectada cria/vincula uma `bank_account`.
   - Buscar movimentações do Itaú por período seguro.
   - Criar lançamentos em `transactions` sem duplicar dados, preservando o contexto Pessoal/Empresa.
   - Atualizar saldo/última sincronização ao fim do processo.

4. **Fallback pragmático: Pluggy primeiro, Itaú direto depois**
   - Como o projeto já tem Pluggy configurado com `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET`, podemos usar Pluggy como caminho mais rápido para Open Finance multibanco.
   - O Itaú direto fica como integração premium/específica quando o certificado estiver 100% válido.
   - Na tela de Integrações, deixar claro qual caminho está pronto para produção e qual depende do certificado.

5. **Teste de ponta a ponta**
   - Testar com uma conta real de baixo risco.
   - Confirmar no app: conectar, sincronizar, ver integração ativa, ver lançamentos criados e abrir conciliação bancária.
   - Registrar erros técnicos em logs, mas mostrar mensagens simples ao usuário.

## O que eu implementaria agora

- Auditar as edge functions Itaú existentes.
- Corrigir o tratamento do certificado e erros.
- Melhorar o fluxo visual do modal Itaú para orientar sobre certificado/senha.
- Garantir que `itau-sync` finalize criando lançamentos reais.
- Se o bloqueio for externo ao Itaú/certificado, reforçar Pluggy como fluxo principal temporário.

## Dependência externa

Para finalizar Itaú direto, precisamos obrigatoriamente de:

- certificado válido exigido pelo Itaú/Open Finance;
- senha do certificado, se aplicável;
- credenciais/client ID do app Itaú;
- confirmação de que a API habilitada no portal Itaú permite consulta de contas/extratos;
- ambiente correto: sandbox ou produção.

Sem isso, conseguimos melhorar código, UX e logs, mas não dá para garantir sincronização real até o fim.