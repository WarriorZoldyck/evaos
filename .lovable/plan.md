
## Problema

Na importação de extrato, "LE BOMBOM 02/03" foi sugerido como `Supérfulo > Doces`, mesmo o próprio usuário já tendo lançado antes "LE BOMBOM 02/03" como `Vestuário > Roupas > Vitória` (confirmado em `transactions`). O Stage 1 atual (merchant key + prefix + tokens com voto ≥60%) deveria ter pegado, mas na prática está deixando escapar e caindo na IA, que erra.

A abordagem pedida pelo usuário é a mais confiável e direta: **se a mesma descrição já existe no histórico, copie exatamente a categoria usada da última vez, sem passar por heurística nem IA.**

## Solução: Layer 0 — Match por descrição normalizada

Nova primeira camada em `src/hooks/useCategorySuggestions.ts`, antes das Layers 1/2/3 e antes do fallback de IA.

### Regra de normalização (agressiva, focada em recuperar a "cara" do lançamento)

Aplicada tanto na descrição da linha importada quanto em cada descrição do histórico:

1. `toLowerCase` + remover acentos.
2. Remover marcador de parcela no fim: `\b\d+\s*\/\s*\d+\b` (`"le bombom 02/03"` → `"le bombom"`).
3. Remover prefixos de adquirente: `mp *`, `cb*`, `pag*`, `pp*`, `pic*`.
4. Colapsar espaços e trim.
5. **Não** filtrar stopwords nem exigir tamanho mínimo — queremos identidade da descrição, não fingerprint.

Chave resultante para o histórico: `normDesc`. A mesma normalização é aplicada na linha da importação.

### Lookup

- Construir `Map<normDesc, HistEntry[]>` sobre a mesma base de amostras já carregada (`transactions` 24m + `ai_pending_transactions` aprovadas), filtrando por `type` compatível.
- Para cada linha a categorizar:
  1. Calcular `normDesc` da descrição.
  2. Buscar no mapa.
  3. Se houver ≥1 entrada com `type` batendo:
     - Preferir a mais recente (`payment_date` desc).
     - Empate: preferir a de maior profundidade (com `subcategory2` > `subcategory` > só `category`).
  4. Aplicar como sugestão com `source: "history"` e `confidence: 4` (novo topo, acima do merchant key exato = 3).
- Se não achar por igualdade exata, tentar também **`startsWith`** do `normDesc` do histórico contra o `normDesc` da linha (cobre "LE BOMBOM" no histórico casando "LE BOMBOM 02/03" na importação e vice-versa, já que o `02/03` foi removido — mas mantém segurança para casos onde só a raiz existe).
- Só se Layer 0 falhar, cair para Layers 1/2/3 atuais e depois IA.

### UI / rótulo

Manter o badge existente "baseado no histórico". Como Layer 0 é um match direto, ele já se encaixa em `source: "history"` sem mudanças de UI.

## Arquivo alterado

- `src/hooks/useCategorySuggestions.ts` — adicionar função `normalizeDescription`, construir o índice `byNormDesc` junto dos outros índices, e inserir o novo "Layer 0" no início do loop de `rows`.

Nenhuma alteração em edge functions, schema ou UI de importação.

## Verificação

Após implementar, testar com o extrato do usuário `espclin@hotmail.com` que trouxe `LE BOMBOM 02/03`, `DROGASIL 3066 03/03`, `AMAZONA WESTERN 10/10`: todos que têm igual (ou raiz igual) já lançados no histórico devem vir com a categoria idêntica à última vez, sem passar pela IA.
