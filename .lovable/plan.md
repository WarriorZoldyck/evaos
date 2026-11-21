# Parcelado: edição nas modalidades, parcelas só como resumo

## O que muda para o usuário

**1. Quadros de modalidade (parte de cima) viram o lugar de editar tudo**
Cada quadro (Cartão, Boleto, Dinheiro, PIX...) terá:
- Valor e "Em quantas vezes?" (como hoje)
- **Cartão:** Maquininha + resumo de taxa/MDR/líquido/recebimento (já existe)
- **Boleto / PIX / Transferência / Cheque:** campo **Conta bancária** (em qual banco cai)
- **Dinheiro:** campo **Carteira**
- **Data do 1º vencimento** e **intervalo** (mensal ou a cada X dias) daquela modalidade — ex.: boletos todo dia 10
- Tabela pequena com as parcelas daquela modalidade, permitindo ajustar data e valor de cada uma (com redistribuição automática da diferença)

**2. "Lançamentos das Parcelas" vira um Resumo (só leitura)**
- Lista cronológica: nº, data, forma, conta/maquininha, valor (bruto e líquido no cartão) e status
- Sem campos editáveis nem "Dividir esta parcela"
- Rodapé com total, total líquido e quantidade
- Texto explicando que a edição é feita nos quadros acima

**3. Baixar resumo (orçamento para o cliente)**
- Botão **"Baixar resumo (PDF)"** no resumo
- PDF com cliente, descrição, valor total, condição por modalidade e o cronograma de parcelas
- Não mostra taxa da maquininha nem valor líquido (informação interna); mostra só o que o cliente paga

## Detalhes técnicos
- `InstallmentPreviewTable.tsx`: mover conta/carteira, data inicial, intervalo e ajuste por parcela para dentro de cada bloco de modalidade; geração das parcelas por modalidade com intercalação por data no resumo.
- Remover controles editáveis da lista de parcelas; manter o mesmo formato de dados enviado ao salvar (sem mudança de banco).
- Validação: cada modalidade exige conta/carteira/maquininha antes de salvar; mensagem aponta a modalidade.
- PDF gerado no navegador com `jspdf` (download via blob), nome `orcamento-<cliente>-<data>.pdf`.
- Atualizar testes existentes das regras de parcelas.
