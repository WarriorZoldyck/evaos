

## Corrigir duplicidade de WhatsApp e prevenir recorrência

### O que foi encontrado
Dois perfis têm o mesmo `whatsapp_number = 5511996346086`:
- `9b5a3c7c` — gurimag77@gmail.com (Dionísio)
- `673ade6e` — renatobruggemann@yahoo.com.br (Renato)

### Plano

#### 1. Limpar o número dos dois perfis
Usar o insert tool para executar:
```sql
UPDATE profiles SET whatsapp_number = NULL 
WHERE id IN ('9b5a3c7c-781d-4826-aa0d-59b5a7f5a883', '673ade6e-570a-4fbe-988a-2917a9c6933e');
```
Cada usuário recadastra o próprio número quando quiser.

#### 2. Criar constraint UNIQUE no whatsapp_number
Migration SQL com índice parcial (ignora NULLs):
```sql
CREATE UNIQUE INDEX unique_whatsapp_number 
ON profiles (whatsapp_number) 
WHERE whatsapp_number IS NOT NULL;
```
Impede que dois perfis cadastrem o mesmo número no futuro.

#### 3. Melhorar matching no webhook
No `whatsapp-webhook/index.ts`:
- Se a query retornar mais de um perfil com o mesmo número, rejeitar com mensagem de erro ao usuário ("Número duplicado, entre em contato com suporte")
- Aumentar rigor do tail-matching de 8 para 10 dígitos

### Arquivos modificados
- **Data fix**: UPDATE via insert tool (limpar números)
- **Nova migration**: UNIQUE index no `whatsapp_number`
- **`supabase/functions/whatsapp-webhook/index.ts`**: Validação de duplicatas

