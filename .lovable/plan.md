## Plano de correção

Vou ajustar a conciliação de cartão para parar de buscar lançamentos fora do período real do extrato importado.

### 1. Usar data de compra do extrato como escopo principal
- Em cartão, o matching vai usar `purchase_date_original` / `date` como data da compra.
- Não vai usar `resolved_competence_date` como data de matching, porque hoje ela pode virar a data de fechamento/competência da fatura e empurrar a busca para Julho.

### 2. Restringir a busca ao intervalo do extrato
- A busca de candidatos no sistema será limitada ao menor e maior dia de compra presentes no extrato.
- Para cartão, a janela será curta e controlada, não mais `±30 dias` nem expansão que puxa compras futuras.
- Wave B, dos lançamentos sem `credit_card_id`, também ficará presa ao intervalo do extrato e aos valores existentes no extrato.

### 3. Corrigir “Só no sistema”
- O painel “Só no sistema” só vai considerar transações dentro do período de compra do extrato.
- Não deve aparecer compra de Julho se o extrato tem compras de Junho.
- Também manterá o filtro por valor do extrato para evitar despejar lançamentos aleatórios.

### 4. Ajustar a lógica pura de matching
- Em cartão, o candidato será comparado pela data real da compra quando existir (`purchase_date_original`/`competence_date` quando apropriado), e não pela data de pagamento da fatura.
- Manter o uso de valor como filtro forte e descrição apenas como desempate/sugestão.

### 5. Adicionar testes contra regressão
- Caso de extrato de Junho não pode sugerir transação de Julho com mesmo valor.
- Caso de lançamento manual em Junho sem cartão, com valor igual, deve aparecer como provável.

Resultado esperado: ao importar o extrato Azul de Junho, o sistema cruza somente compras dentro do escopo desse extrato e deixa de mostrar lançamentos futuros de Julho ou totais absurdos.