## Diagnóstico confirmado

Consultei diretamente o banco para `espclin@hotmail.com` e os exemplos citados existem no histórico do próprio usuário, mas alguns não aparecem na importação por dois motivos diferentes:

- **Categorias existem em outro contexto/empresa**: vários históricos estão com `company_id = a206...`, mas a tela de importação recebe apenas `categories` do contexto atual. Assim, o sistema até acha o histórico, mas não consegue reconstruir corretamente o caminho da categoria no seletor atual.
- **Subcategorias misturadas entre contextos**: há lançamentos com raiz de uma empresa e subcategoria de outro contexto, por exemplo `AMAZONA WESTERN` com `Vestuário` de uma empresa, `Roupas` pessoal e `Paula` de empresa. Isso faz a UI não conseguir montar a árvore completa.
- **Parcelas futuras não estão no banco ainda**: para `TEIXEIRA MODA INTIMA 02/02`, `ROS/EROS BOUTIQUE 02/03`, `LE BOMBOM 03/03`, `AMAZONA WESTERN 10/10` e `IBERIA ... 10/10`, o banco tem parcelas anteriores, mas não necessariamente a parcela exata final. Para categorização isso deveria funcionar por histórico; para conciliação com lançamento existente só funciona se a parcela já existe como transação.
- **DROGASIL bateu parcialmente**: há histórico como `Saúde > Farmácias` e também `Saúde > Farmácia > Drogasil`. O algoritmo atual tende a escolher pelo volume de amostras, não pela categoria mais específica quando há conflito.
- **FAUSTO/PAULO FERREIRA**: a amostra do banco para `FAUSTO FERREIRA` está como `Sem Categoria`, então a sugestão que aparece veio de token/similaridade com outro Ferreira (`Luma/Compra Luma Borges Ferreira`) e por isso a lógica cruzou texto certo, mas categorizou errado.

## Plano de correção

1. **Usar categorias globais do usuário na importação**
   - Passar `allCategories` para o modal de importação, não só as categorias do contexto atual.
   - Usar essa lista global para resolver UUIDs em nomes e montar os caminhos exibidos.
   - Manter o isolamento por `user_id`; nada cruza dados entre usuários.

2. **Separar “categoria para sugerir” de “categoria selecionável”**
   - A sugestão histórica pode vir de qualquer contexto do usuário.
   - Se a categoria sugerida não existir no contexto atual, mostrar o caminho real do histórico e ainda permitir importar com esse caminho por nome.
   - Evitar que IDs brutos ou caminhos quebrados apareçam no seletor.

3. **Melhorar ranking do histórico**
   - Dar prioridade maior para:
     - descrição normalizada igual/parcelas do mesmo estabelecimento;
     - mesma raiz + maior profundidade (`categoria > sub > sub2`);
     - histórico mais recente;
     - consenso apenas dentro do mesmo comerciante real.
   - Reduzir o peso de token genérico de sobrenome/palavra solta, para evitar `FAUSTO/PAULO FERREIRA` herdando categoria de outro “Ferreira”.

4. **Tratar parcelas como o mesmo comerciante**
   - Normalizar descrições removendo `01/03`, `02/03`, `10/10`, códigos longos e ruídos antes do cruzamento.
   - Assim `LE BOMBOM 03/03` aprende com `LE BOMBOM 01/03` e `02/03`; idem `IBERIA`, `AMAZONA WESTERN`, `TEIXEIRA`, `ROS/EROS BOUTIQUE`.

5. **Criar um relatório de auditoria no próprio popover**
   - Mostrar claramente se o match veio de `transactions` ou `ai_pending_transactions`.
   - Mostrar por que escolheu aquela categoria: “mesma descrição sem parcela”, “mesmo comerciante”, “tokens fortes”.
   - Quando não houver base confiável, deixar “Selecionar categoria” em vez de chutar.

6. **Validação final com os casos citados**
   - Conferir que os exemplos passam a se comportar assim:
     - `TEIXEIRA MODA INTIMA 02/02` → `Vestuário > Roupas > Langerie`
     - `ROS/EROS BOUTIQUE 02/03` → `Vestuário > Roupas > Paula`
     - `LE BOMBOM 03/03` → `Vestuário > Roupas > Vitória`
     - `DROGASIL 3066 03/03` → preferir o caminho mais específico quando existir: `Saúde > Farmácia > Drogasil`, senão `Saúde > Farmácias`
     - `AMAZONA WESTERN 10/10` → `Vestuário > Roupas > Paula`
     - `IBERIA LINEA... 10/10` → `Férias > Aéreo > Iberia`
     - `PAULO/FAUSTO FERREIRA` → não categorizar por sobrenome se não houver histórico confiável do mesmo comerciante

## Arquivos a alterar

- `src/pages/Lancamentos.tsx`
- `src/components/lancamentos/ImportStatementModal.tsx`
- `src/hooks/useCategorySuggestions.ts`
- `src/components/lancamentos/import/SuggestionWhyPopover.tsx`

Não pretendo alterar dados do banco agora; primeiro vou corrigir a lógica para todo usuário. Se depois quisermos limpar categorias antigas inconsistentes entre contextos, faço isso como etapa separada com SQL auditável.