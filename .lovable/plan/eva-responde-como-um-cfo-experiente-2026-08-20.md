# EVA responde como um CFO experiente

A resposta do WhatsApp no print ("Metas deste mês — 65% do mês já passou") não passou pelo motor analítico: ela é um **relatório fixo montado em código** (`metas_mes`). Ele lista números corretos, mas não interpreta nada — não diz o que fazer, não projeta o fechamento do mês, não recomenda.

E mesmo quando a análise roda, o texto de sistema hoje descreve a EVA como "analista financeira": ela devolve conta + bullets, mas não age como um CFO (cenários, política financeira, capital de giro, pró-labore bruto x líquido, regime tributário) — que é exatamente o nível do print do ChatGPT.

## O que muda

**1. Persona de CFO, não de analista**
A EVA passa a se comportar como CFO com anos de experiência:
- Nunca aceita a conta simplista. Se o usuário pede "40 mil ÷ 40% = 100 mil", ela mostra por que isso deixa a empresa apertada e propõe o número saudável.
- Sempre explicita as premissas ("estou assumindo que 40% é margem líquida operacional, antes da retirada dos sócios").
- Distingue pró-labore bruto de líquido, cita INSS/IR e regime tributário quando o cálculo depende disso.
- Reserva capital de giro / caixa-alvo (meses de custo fixo) faz parte de toda recomendação de retirada.

**2. Resposta em estrutura de CFO**
Padrão fixo para perguntas analíticas:
1. Conclusão direta (o número).
2. Conta-base — tabela item x valor (faturamento, custos, resultado, retiradas, sobra).
3. Cenários — 3 a 4 faixas de faturamento com resultado, retirada e retenção.
4. Ressalvas (bruto x líquido, impostos, sazonalidade).
5. "A política que eu adotaria": meta mínima, meta confortável, margem mínima, retenção mínima, caixa-alvo.

**3. Metas do mês deixam de ser só números**
O relatório determinístico continua (os valores são conferidos e batem com a tela), mas ganha uma **leitura da EVA** logo abaixo: projeção de fechamento do mês no ritmo atual, onde está o risco, e 2-3 ações concretas. Sem inventar número: a leitura usa os mesmos totais do relatório.

**4. Mais matéria-prima para a análise**
O bloco de dados enviado à IA passa a incluir:
- Saldos atuais por conta e caixa total (hoje só lista nomes de conta).
- Limite e uso dos cartões.
- Compromissos futuros (pendentes/parcelas a vencer nos próximos 3 meses).
- Margem e resultado por mês já calculados, com tendência dos últimos 3 meses x 12 meses.
- Meses de caixa que o saldo atual cobre frente aos custos fixos.
- Quantidade de sócios/retiradas identificadas em categorias de pró-labore, quando existirem.

**5. Tamanho da resposta por canal**
- App: markdown completo, com tabelas e cenários (nível do print do ChatGPT).
- WhatsApp: versão executiva — conclusão, conta-base em linhas curtas, cenários em até 4 linhas, política em bullets; quebrada automaticamente em 2 mensagens quando passar do limite, em vez de cortar o raciocínio.

## Detalhes técnicos

- `supabase/functions/_shared/eva-analysis.ts`:
  - novo prompt de sistema com persona CFO e a estrutura de saída obrigatória (conclusão → conta-base → cenários → ressalvas → política);
  - `buildAnalysisData` passa a agregar saldos (`bank_accounts` + soma de transações pagas), limites/uso de cartão, pendentes futuros, margem mensal, runway em meses e retiradas de sócio;
  - `max_tokens` sobe de 2500 para ~6000; modelo segue `google/gemini-2.5-pro`;
  - helper `splitForWhatsApp` para dividir mensagens longas.
- `supabase/functions/whatsapp-webhook/index.ts`: no case `metas_mes`, após montar o relatório determinístico, chamada de "leitura do CFO" com os totais do próprio relatório, anexada à mensagem; envio em partes quando necessário.
- `supabase/functions/eva-chat/index.ts`: mesma leitura de CFO no caminho equivalente de metas e reaproveitamento do prompt novo.
- Erros do gateway (402/429) continuam com o tratamento atual; se a leitura de CFO falhar, o relatório numérico é enviado assim mesmo.

## Fora de escopo

- Novas telas no app.
- Persistência do histórico de análises.
