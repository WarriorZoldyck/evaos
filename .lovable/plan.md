# Correção: EVA vazando dict cru no WhatsApp

## Diagnóstico

A imagem mostra que a EVA enviou ao usuário o **dict bruto em formato Python** (aspas simples, `None`, `\n` literais) em vez da `friendly_message`.

Rastreando em `supabase/functions/whatsapp-webhook/index.ts`:

1. A IA respondeu nesse caso com sintaxe **Python**, não JSON: `{'intent': 'lancamento', ... 'category_id': '160d90e0-...', ... None, ...}`.
2. `parseJsonRobust` (linhas 2086-2118) só tenta `JSON.parse` — falha em aspas simples e em `None`/`True`/`False`.
3. Cai no fallback (linha 2121-2131): envia o **texto cru** como `friendly_message` ao usuário. É exatamente o que aparece no print.

A memória `mem://whatsapp/json-parsing-resilience` já prevê "markdown salvage", mas não cobre o caso "Python dict literal".

## Correção

Em `supabase/functions/whatsapp-webhook/index.ts`, dentro de `parseJsonRobust`, adicionar uma **etapa final de salvamento Python→JSON** antes de desistir:

```text
- Detectar quando o texto parece dict Python (contém "': '" ou ": None" / ": True" / ": False").
- Converter de forma segura:
    • None → null
    • True → true
    • False → false
    • aspas simples delimitadoras de chave/valor → aspas duplas
      (sem quebrar apóstrofos dentro de strings: usar um conversor que
       respeite o estado dentro/fora de string, em vez de replace global)
- Tentar JSON.parse no resultado.
```

Implementação: pequeno tokenizador linear que percorre os caracteres mantendo o estado `inString` e o caractere de abertura (`'` ou `"`). Quando `'` está fora de string, troca por `"`; aspas duplas dentro de string passam a ser escapadas. `None|True|False` são substituídos só quando estão fora de strings.

Adicional de defesa-em-profundidade no fallback (linha 2121):

- Se mesmo após o salvamento Python ainda falhar e o texto **parecer um dict** (começa com `{` e contém `'intent'`), **não** enviar o cru. Em vez disso:
  - Tentar extrair via regex apenas o valor de `friendly_message` (`'friendly_message': '...'`) e enviar só ele.
  - Caso contrário, devolver a mensagem genérica "não consegui entender, pode reformular?" — nunca o JSON cru.

## Validação

- Atualizar `supabase/functions/whatsapp-webhook/index.ts` apenas (sem mudanças de schema).
- Não há testes desta função no projeto; validar manualmente:
  1. Após o deploy, refazer um lançamento do mesmo tipo (pix Vanessa → Banco do Brasil) e confirmar que o usuário recebe a `friendly_message` ("📋 Lançamento enviado para aprovação...").
  2. Verificar nos logs que, se a IA voltar a responder em Python, aparece o warning de salvamento e a resposta enviada ao WhatsApp é a `friendly_message`, não o dict.

## Escopo

- 1 arquivo alterado: `supabase/functions/whatsapp-webhook/index.ts` (função `parseJsonRobust` + bloco de fallback imediatamente abaixo).
- Sem alteração de prompt, sem alteração de banco, sem alteração de UI.
