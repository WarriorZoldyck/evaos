## Problema confirmado

No extrato de junho tem **2 sorvetes em 06/06 (R$ 25 cada)** — as duas linhas aparecem no PDF:

```
06/06 ItalyanSorvetes    25,00
06/06 ItalyanSorvetes    25,00
```

No sistema há **apenas 1 lançamento de sorvete em 06/06**. Então:

1. A divergência de R$ 25 no card "Sistema × Extrato" está correta — falta 1 sorvete no sistema.
2. O que está errado é que o matcher **não conseguiu ligar** nem o primeiro sorvete do extrato ao lançamento do sistema — porque o texto "ItalyanSorvetes" não bate com a descrição do lançamento no sistema (que provavelmente está com nome do fornecedor / categoria diferente). O gate `AUTO_LINK_MIN_SIMILARITY = 0.34` está bloqueando.

Sua leitura está certa: quando **data + valor + fornecedor** batem, não faz sentido exigir similaridade textual da descrição livre.

## O que vou mudar (Onda 1.5 — cirúrgico, antes da Onda 2)

Arquivo: `src/lib/import/matching.ts`

**1. Novo sinal "fornecedor casou" no `scoreCandidate`:**
   - Já existe `contactSim` (similaridade com `candidate.contact_name`). Vou expô-lo separado no `ScoredCandidate` como `contactMatched: boolean` (true quando `contactSim ≥ 0.5` **ou** `sharesToken(line.description, contact_name)`).

**2. `pickBestMatch` — bypass do gate de similaridade quando o trio forte casa:**
   - Auto-linkar mesmo com `similarity < 0.34` SE, no modo cartão:
     - `tier === "exact"` (valor idêntico), **e**
     - `dayDiff === 0` (mesmo dia), **e**
     - `contactMatched === true` (fornecedor bateu por token/similaridade).
   - Fora desse trio, mantém o gate atual (evita o bug Sabrina/Renato).

**3. Boost de score quando contato casa:**
   - Hoje: `+15` se `sharesToken(desc, contact_name)`. Vou somar mais `+10` quando `contactSim ≥ 0.5` (nome do fornecedor aparece "quase igual" na linha do extrato, como "ItalyanSorvetes" vs contato "Italyan Sorvetes").

**4. Ampliar o pool de candidatos (opcional, mesmo arquivo):**
   - Em `useImportMatching.ts` o filtro por valor já usa `AMOUNT_TOLERANCE`. Sem mudança aqui.

## O que NÃO muda

- Continua exigindo mesmo tipo (receita/despesa), valor dentro da tolerância e data dentro da janela do cartão (5 dias). Sem risco de casar coisas distantes.
- Guard de parcela (`V03/12` ≠ `V02/12`) permanece.
- Onda 2 (quadrante "Divergência de valor") fica para depois desta correção.

## Resultado esperado no seu caso

- 1º sorvete do extrato (06/06, R$ 25, "ItalyanSorvetes") → casa automaticamente com o lançamento do sistema (mesma data, mesmo valor, fornecedor "Italyan Sorvetes" no contato).
- 2º sorvete do extrato (06/06, R$ 25, "ItalyanSorvetes") → aparece em "Só no extrato" com sugestão de criar como nova compra (é a compra real que faltou lançar).
- Card "Sistema × Extrato" continua mostrando os R$ 25 de diferença até você decidir criar o 2º sorvete.

## Testes

- Ajustar `matching.test.ts` para cobrir: (a) trio forte casa mesmo com descrição totalmente diferente; (b) trio forte não casa se o fornecedor não bater; (c) casos existentes continuam válidos.

Aguardando seu OK para aplicar.