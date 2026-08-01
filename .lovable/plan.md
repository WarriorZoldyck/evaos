# Reabrir a importação de 30–31/07 (simoespaula) na tela de conciliação

Objetivo: em vez de corrigir tudo por SQL, colocar os lançamentos daquela importação de volta na tela de importação/conciliação, com fornecedor, descrição e categoria editáveis, para a própria usuária concluir. Os lançamentos existentes permanecem no sistema e são **atualizados** ao salvar — nada é duplicado.

## Escopo

- Somente a conta `simoespaula@gmail.com`.
- Somente os lançamentos criados em 30–31/07/2026 por aquela importação (o lote de 182), com destaque para a fatura Santander de março (~R$ 26 mil, arquivo "fatura 3"). Antes de gerar qualquer coisa, confirmo por consulta quantos desses lançamentos pertencem a essa fatura e qual o total — se o total não bater com os ~R$ 26 mil, eu volto e aviso em vez de seguir.

## Como vai funcionar

1. **Novo modo "Revisar importação" na tela de importação.** A tela ganha uma entrada alternativa: em vez de subir um arquivo, ela carrega um lote de lançamentos já existentes como se fossem as linhas do extrato.
2. Cada linha já chega **vinculada ao próprio lançamento** do sistema (ação "vincular"), então a conciliação não cria nada novo — ela só edita.
3. A usuária revisa/ajusta em linha: fornecedor (com busca), descrição e categoria em 3 níveis, exatamente com a UI que já existe hoje.
4. Ao finalizar, o sistema faz **update** dos lançamentos vinculados (categoria, subcategoria, descrição, fornecedor). Nenhum insert, nenhuma exclusão.
5. O rascunho continua sendo salvo automaticamente (localStorage), então ela pode sair e voltar sem perder o trabalho.
6. As sugestões automáticas de categoria/fornecedor por histórico continuam ativas, então boa parte das linhas já chega preenchida.

## Como ela chega nessa tela

Um link direto (rota da importação com um parâmetro identificando o lote). Envio o link para ela; ao abrir, o lote aparece pronto para revisão.

## Detalhes técnicos

- `ImportStatementModal.tsx`: nova prop/param de "lote de revisão". Quando presente, pula o upload e o parser, monta `rows` a partir das transações do lote e pré-preenche `matchActions[i] = "vincular"` + `matchTargets[i] = transaction.id`.
- Commit final: caminho separado que faz `update` nas transações vinculadas (`category`, `subcategory`, `subcategory2`, `description`, `supplier_id`/`client_id`) em vez de `createMultipleTransactions`.
- Identificação do lote: filtro por `user_id` + `created_at` em 30–31/07/2026 (e, para a fatura Santander, também `credit_card_id` + mês de referência). Nenhum outro usuário é alcançado.
- A trava de divergência de saldo fica desativada nesse modo (não há extrato bancário a bater — a fonte é o próprio lançamento).
- A tabela de resguardo `backup_simoespaula_categorias_20260801` permanece como está, servindo de rede de segurança.
