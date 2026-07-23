
## Problema

Hoje o "aprendizado" da EVA na importação é fraco:

- `useCategorySuggestions` só olha 12 meses de `transactions`, filtra tokens ≥4 letras e exige 2 hits (ou 1 hit longo).
- Descrições de cartão são curtas e ruidosas: `MP * Bdprv`, `SPAY *POLIMPORT`, `IBERIA LINEA075...`, `CB*CAMPEAO`. O tokenizador atual quebra em palavras e ignora prefixos como `MP`, `SPAY`, `CB`, então merchants recorrentes viram "1 token curto" e caem no fallback da IA.
- Tokens genéricos (`PAGAMENTO`, `COMPRA`, `DEBITO`, `PARCELA`, `FATURA`, nomes de cidade, mês) contam igual a tokens de merchant, então às vezes casa errado, às vezes não casa nada.
- Só usa `transactions`. Itens que o usuário aprovou em Análises EVA ou categorizou numa importação anterior do MESMO cartão ficam de fora se ainda estiverem em `ai_pending_transactions` ou se a limpeza de 12m os cortou.

Ou seja: cada import parte praticamente do zero e a IA acaba fazendo o trabalho todo (com erros).

## Objetivo

Transformar a Stage 1 de `useCategorySuggestions` num matcher de merchant de verdade — sem introduzir tabela nova nem servidor de ML. É agregação em cima do próprio histórico do usuário, feita no cliente na hora do import.

## 1. Ampliar e enriquecer a amostra

Em `src/hooks/useCategorySuggestions.ts`:

- Janela: 24 meses (era 12). Limite: 5000 (era 2000), com order by `payment_date desc` pra pegar o mais recente primeiro.
- Somar também `ai_pending_transactions` do mesmo `user_id` com `status = 'approved'` e categoria não nula — são exatamente os lançamentos que o usuário confirmou pela EVA/WhatsApp, o sinal mais forte de "isso é assim que eu categorizo".
- Continuar normalizando category/subcategory/subcategory2 de UUID → nome via `categories`.

## 2. Fingerprint de merchant (não só bag-of-tokens)

Descrições de cartão têm um padrão: `PREFIXO*MERCHANT SUFIXO_NUMÉRICO PARCELA`. Extrair um "merchant key" estável:

- Normalizar (lowercase, sem acento, sem pontuação, colapsar espaços) — já existe.
- Remover sufixos de parcela (`\s*\d+/\d+\s*$`), sequências numéricas longas (`\d{4,}`), e tokens de uma stopword list: `pagamento, compra, debito, credito, transf, transferencia, pix, tef, boleto, fatura, parc, parcela, mensal, anual, taxa, tarifa, saque, deposito, iof`, meses (`jan..dez / janeiro..dezembro`), e códigos de 1-3 letras isolados quando vierem antes de `*` (`mp *`, `cb*`, `spay *`, `pag*`, `pp*`).
- Do que sobrar, gerar dois níveis de chave:
  - `merchantKey` = primeiros 2 tokens significativos concatenados (`campeaosupermercados`, `iberialinea`, `mulligangolfbar`).
  - `merchantPrefix` = os primeiros 6 caracteres do `merchantKey` (para pegar `CAMPEAO SUPERMERCADOS BURITIS` ≈ `CAMPEAO SUPERM…`).

## 3. Novo matcher em três camadas (ordem de prioridade)

Para cada linha nova, tentar nesta ordem e parar no primeiro hit:

1. **Exact merchant key** (`merchantKey` idêntico entre a nova linha e alguma amostra do mesmo `type`).
2. **Prefix merchant key** (primeiros 6 chars iguais).
3. **Token overlap** — a lógica atual, mas com stopwords removidas e gate ajustado: aceita se ≥2 tokens significativos batem, OU 1 token ≥7 letras (era 6) bater.

Em cada camada, agregar todas as amostras que batem por triple `(category, subcategory, subcategory2)`, contar ocorrências, e escolher:

- A triple mais frequente.
- Empate → a mais profunda (subcategory2 > subcategory > category).
- Empate ainda → a mais recente por `payment_date`.

Aceitar o hit apenas se ele tiver ≥60% dos votos das amostras casadas (evita "5 amostras, 5 categorias diferentes" virarem chute).

## 4. Não mandar o que já foi resolvido para a IA

O que a Stage 1 resolveu não vai para `suggest-categories`. O que sobrar continua indo pra Gemini Flash como hoje (Stage 2 sem mudança). Isso reduz custo/latência da IA proporcionalmente ao quanto o usuário já categorizou.

## 5. Overlay de loading

Manter como está — já foi entregue na rodada anterior. Só ajustar o texto do overlay pra mostrar `X de Y categorizados` conforme a Stage 1 vai marcando (Stage 1 é síncrona, então o número já pode aparecer antes do fetch da IA começar). Sem refatorar o retorno do hook.

## O que NÃO muda

- Estrutura do `suggest-categories` (prompt, batches, modelo Gemini Flash, Promise.all) fica igual.
- Nenhuma tabela nova. Nenhum job de background. Nenhum embedding/vector store — é agregação determinística sobre o histórico que o usuário já tem no Supabase.
- `ReconcileStep` continua igual, exceto pelo texto do overlay.

## Detalhes técnicos

Arquivo único: `src/hooks/useCategorySuggestions.ts`.

- Extrair `buildMerchantKey(description)` e `STOPWORDS`/`MONTHS`/`PREFIX_NOISE` como constantes no topo do arquivo.
- Trocar o `tokenIdx: Map<token, HistEntry[]>` por três índices construídos no mesmo loop sobre o histórico:
  - `byMerchantKey: Map<string, HistEntry[]>`
  - `byMerchantPrefix: Map<string, HistEntry[]>`
  - `byToken: Map<string, HistEntry[]>` (só tokens não-stopword, ≥4 letras)
- Cada `HistEntry` ganha `payment_date` (string ISO) pra desempate por recência.
- Função `pickBest(entries: HistEntry[])` que faz o voting descrito na §3 e devolve `{ triple, confidence } | null`. Reutilizada nas três camadas.
- Query adicional para `ai_pending_transactions` (mesmo user, `status = 'approved'`, categoria não nula) roda em paralelo (`Promise.all`) com a query de `transactions`.

Sem mudanças em edge functions, sem migrations.

## Pergunta antes de implementar

Você quer que eu já inclua as amostras aprovadas em `ai_pending_transactions` como fonte de aprendizado (recomendo sim — é o sinal mais forte que temos), ou prefere manter só `transactions` nessa rodada?
