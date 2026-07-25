## Plano: Auditar reimportação do usuário espclin

Aguardar o usuário concluir a reimportação e categorização dos 2 extratos, depois auditar diretamente no banco se a EVA está persistindo as categorias corretamente.

### Passos

1. **Snapshot antes/depois** — registrar contagem atual de `transactions` categorizadas do `user_id = b049592f-d97a-468d-a839-ed02c2a41d9b` para comparar após o import.

2. **Consultar as novas linhas** em `public.transactions` filtrando por `user_id` + `created_at > agora` para pegar só o que a reimportação inseriu.

3. **Validar campo a campo** em cada linha nova:
   - `category_id`, `subcategory_id`, `subcategory2_id` populados com UUIDs válidos que existem em `public.categories` do próprio usuário
   - `credit_card_id` bate com o cartão do usuário (não com cartão de outro user)
   - `description` normalizada corretamente (sem ruído tipo `03/03`, `SPAY *`, `LINEA...`)

4. **Cruzar com sugestões esperadas** — para cada merchant recorrente (DROGASIL, IBERIA, LE BOMBOM, EROS BOUTIQUE, TEIXEIRA, AMAZONA WESTERN, etc.), verificar se a categoria persistida bate com o histórico anterior do próprio user.

5. **Relatório para o usuário** — tabela com:
   - Merchant | Categoria persistida | Categoria esperada (histórico) | ✅/❌
   - Total de linhas categorizadas vs "Sem Categoria"
   - Qualquer divergência entre o que a UI mostrou e o que ficou salvo

6. **Se houver divergência**, investigar se o problema é:
   - Persistência (UI mostrou certo, banco salvou errado)
   - Sugestão (histórico existia mas não foi encontrado — bug em `useCategorySuggestions.ts`)
   - Ausência de histórico (esperado — usuário categoriza 1x e EVA aprende)

Nenhum código será alterado neste plano — é puramente auditoria. Se aparecer bug real de persistência ou de matching, abro plano separado de correção.
