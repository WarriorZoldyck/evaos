
## Consertar a raiz — invariante "transfer_id ⇒ is_internal_transfer=true"

Hoje o cálculo de faturamento/DRE depende de `is_internal_transfer`, mas nada no banco garante que essa flag seja setada quando um par de transferência é criado. Resultado: qualquer usuário pode ter pró-labores/transferências contando 2× no faturamento sem a gente perceber. Vou tratar isso em 4 camadas:

### 1. Auditoria global (uma query, todos os usuários)
Identificar todos os lançamentos no sistema com `transfer_id NOT NULL` e `is_internal_transfer=false` — quantos usuários, quantos lançamentos, quanto R$. Isso dá o tamanho real do problema antes de qualquer alteração de esquema.

### 2. Correção retroativa em massa (data migration)
Um único `UPDATE` global:
```sql
UPDATE public.transactions
   SET is_internal_transfer = true
 WHERE transfer_id IS NOT NULL
   AND is_internal_transfer = false;
```
Sem exceções — se tem par de transferência, é transferência interna, ponto.

Além disso, para pares em que um lado ficou com `company_id NULL` mas a conta pertence a uma empresa, herdar o contexto da `bank_accounts.company_id`. Isso cobre o "sem contexto" que apareceu no espclin.

### 3. Trigger de invariante (impede que o problema volte)
```sql
CREATE OR REPLACE FUNCTION public.enforce_transfer_flag()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.transfer_id IS NOT NULL THEN
    NEW.is_internal_transfer := true;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER transactions_enforce_transfer_flag
BEFORE INSERT OR UPDATE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.enforce_transfer_flag();
```
Com isso, mesmo que qualquer código (frontend, edge function, WhatsApp AI, importador de extrato) esqueça de setar a flag, o banco corrige sozinho. Impossível regressão.

### 4. Auditoria "saúde de dados" recorrente (dashboard interno EVA Hub)
Uma view/consulta simples que roda quando você quiser (ou como card no `/hub`) mostrando por usuário:
- lançamentos com `transfer_id` sem par (transferência órfã)
- lançamentos de receita com `company_id NULL` em contas que **têm** `company_id`
- pares de transferência com valores diferentes entre os dois lados

Assim, quando um cliente reclamar "meu faturamento está errado", em vez de você descer no SQL a mão, você abre o painel e vê exatamente qual anomalia bater.

---

### Ordem de execução
1. Rodar a auditoria global (SELECT, só leitura) e trazer os números.
2. Migração de banco: `UPDATE` retroativo + trigger de invariante (uma única migration).
3. Adicionar seção "Saúde de dados" no `/hub` (ou nova rota `/hub/integridade`) com as 3 consultas de anomalia.
4. Documentar no memory do projeto a invariante `transfer_id ⇒ is_internal_transfer` como regra de arquitetura.

### O que **não** vou mexer
- Cálculo do card Faturamento (já correto, usa bruto).
- Lógica de criação de transferência no frontend (o trigger cobre — não precisa refatorar 5 pontos).
- Dados de outros usuários manualmente — a migration global cuida.

### Pergunta antes de executar
Você quer que eu **inclua o painel "Saúde de dados" nessa rodada** (item 4), ou primeiro só a auditoria + migration (itens 1–3) e o painel eu faço em seguida?
