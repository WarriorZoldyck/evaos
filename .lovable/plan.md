

## Diagnóstico: Por que a EVA não está reutilizando a categoria do Empório Moscato

### Root Cause identificada

Analisei os dados reais do Renato e o código. O Renato tem **3 transações** com Empório Moscato no contexto Pessoal, todas usando a categoria "Supérfulos" (`100944ed`). A heurística de reuso histórico DEVERIA ter pego isso, mas há **3 bugs** impedindo:

**Bug 1: O issuer_name do documento não alimenta o matching histórico**
O `extractDocumentParties` extrai `issuer_name: "EMPORIO MOSCATO"`, mas esse valor só é usado para detecção de contexto (empresa). No bloco de reuso histórico (linha 1769), o código usa `aiParsed.contact_name` e `aiParsed.description` — mas a IA pode NÃO colocar "Empório Moscato" nesses campos. O issuer_name extraído do documento nunca chega à heurística de matching.

**Bug 2: As transações históricas do Moscato têm `contact_name: NULL`**
Na base, as 3 transações do Moscato têm `contact_name: null`, apenas `description: "Empório Moscato"`. A heurística tenta casar `aiContact` com `htxContact`, mas `htxContact` é vazio. O fallback por descrição depende de o AI incluir "empório moscato" na description — o que nem sempre acontece.

**Bug 3: `contextCategories` é `const` e não se atualiza após cross-context resolution**
Se o cross-context account resolution (linha 1670) mudar o `companyId`, o `contextCategories` (definido como `const` na linha 1473) permanece filtrado pelo contexto ANTIGO. A categoria "Supérfulos" estaria fora do filtro.

### Correções

Todas no arquivo `supabase/functions/whatsapp-webhook/index.ts`:

#### 1. Usar issuer_name do documento como sinal primário no matching histórico
No bloco de reuso (linha ~1769), adicionar o `documentPartyExtraction?.issuer_name` como sinal extra. Se o nome do emissor do documento corresponder a uma descrição ou contact_name no histórico, fazer match imediato. Isso resolve o caso do comprovante de cartão onde o estabelecimento está claro no documento.

#### 2. Matching bidirecional issuer ↔ descrição histórica
Além de comparar `aiContact` vs `htxContact`, comparar o `issuer_name` normalizado contra `htxDesc` (descrição das transações históricas). Se o issuer name aparece dentro da descrição histórica, é match. Assim, "emporio moscato" do documento casa com a descrição "Pagamento no Empório Moscato" do histórico.

#### 3. Tornar `contextCategories` mutável (let)
Mudar `const contextCategories` para `let contextCategories` e re-filtrar após o cross-context account resolution, da mesma forma que já é feito para `contextAccounts`, `contextWallets` e `contextCards`.

#### 4. Adicionar logs de diagnóstico
Logar: quantas transações históricas foram carregadas, quantos padrões foram gerados, e quando o matching falha (com os valores tentados). Isso evita debugging cego no futuro.

#### 5. Reforço no prompt: AI deve sempre retornar contact_name com nome do estabelecimento
Adicionar instrução explícita para que quando houver documento/recibo, o `contact_name` SEMPRE contenha o nome do estabelecimento/emissor identificado no documento.

### Resultado esperado
Para o caso do Empório Moscato:
1. Documento chega → `issuer_name: "EMPORIO MOSCATO"` extraído
2. Heurística histórica compara "emporio moscato" contra descrições históricas → match com "Empório Moscato" (descrição) → categoria "Supérfulos" reutilizada automaticamente
3. Lançamento criado sem perguntar sobre categoria

