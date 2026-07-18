## Contexto

O usuário `espclin@hotmail.com` recebeu erro ao importar extrato. Os logs mostram que **não é** o problema anterior de timeout do modelo — é um **401 Unauthorized** retornado em ~1s pela `parse-bank-statement`, causado por sessão do Supabase Auth invalidada (`session id doesn't exist` no auth log).

O modal atual mostra apenas "Não foi possível processar o arquivo. Tente novamente.", sem indicar que o problema é a sessão. O usuário fica preso tentando reenviar o arquivo sem sucesso.

## Mudanças

### 1. `src/components/lancamentos/ImportStatementModal.tsx`
No bloco de tratamento de erro (~linha 299), inspecionar `fnError`:
- Se `status === 401` ou mensagem contém "Unauthorized" / "session": mostrar toast claro ("Sua sessão expirou. Faça login novamente para importar o extrato.") e, opcionalmente, chamar `supabase.auth.signOut()` + redirecionar para `/auth`.
- Se o erro vier do timeout de 120s: manter mensagem atual sobre demora.
- Demais erros: manter mensagem genérica, mas incluir `fnError.message` quando presente para facilitar suporte.

### 2. Verificação preventiva antes do upload
No início de `handleFile` (antes do `supabase.functions.invoke`), fazer um `supabase.auth.getSession()`. Se não houver sessão válida, abortar com o mesmo toast de "sessão expirou" — evita subir o PDF inteiro para receber 401 no fim.

### 3. Nada muda no edge function
A `parse-bank-statement` já retorna 401 corretamente. As correções de modelo (`gemini-2.5-flash` + fallback + `AbortController` 90s) do turno anterior permanecem — resolvem o outro caso (546/timeout), que era um problema diferente.

## Detalhes técnicos

- `supabase.functions.invoke` empacota erros HTTP no objeto `FunctionsHttpError`; o `status` fica em `fnError.context?.status` ou pode ser inferido tentando `fnError.name === 'FunctionsHttpError'` + `await fnError.context.json()`.
- Preservar o `Promise.race` de 120s já adicionado.
- Não alterar RLS, config.toml ou schema.
