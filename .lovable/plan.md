

## Plano: Relatório de Análise de Negócio EVA OS (PDF)

Vou gerar um documento PDF profissional com a análise completa do EVA OS vs mercado, custos operacionais, estrutura de planos e pitch de vendas.

### Conteúdo do documento

**1. Visão Geral do Produto**
- Inventário completo de funcionalidades (Dashboard, Multi-contas, Precificação FHC, DRE, Plano de Caixa, Maquininhas/MDR, EVA IA via chat + WhatsApp, Importação de extratos, Metas, Contatos, Multi-empresa)

**2. Análise de Mercado — Concorrentes Diretos**
- Conta Azul: R$159-459/mês (MEI a PME), foco contábil, NF-e, 671 funcionários, $30M receita anual
- Granatum: R$396/mês preço único, focado em gestão financeira pura
- Nibo: R$166-278/mês, foco BPO financeiro e contadores
- Diferencial EVA OS: IA nativa (chat + WhatsApp), precificação FHC (nicho saúde), preço muito mais acessível

**3. Custos Operacionais**
- Supabase Pro: ~$25/mês por projeto (DB, Auth, Edge Functions)
- Lovable AI Gateway (Gemini 2.5 Flash): $0.30/1M input tokens + $2.50/1M output tokens
- Estimativa por interação EVA: ~2K tokens input (contexto) + ~500 tokens output = ~$0.00185/interação
- Custo WhatsApp (Evolution API): infraestrutura própria
- Estimativa mensal por usuário ativo (30 interações/mês): ~$0.06/usuário

**4. Proposta de Planos Revisada**
- Starter (Grátis): Isca, 1 conta, sem IA
- Pro (R$49/mês): Contas ilimitadas, 50 interações EVA/mês, Precificação V1
- Clínica (R$99/mês): Tudo Pro + Precificação V2, WhatsApp, importação extratos, 200 interações EVA
- Franquia (R$199/mês): Multi-empresa consolidada, membros, interações ilimitadas

**5. Unit Economics e Break-even**
- CAC estimado, LTV, margem por plano
- Break-even por tier considerando custos de infra + IA

**6. Pitch de Vendas**
- Proposta de valor em 1 frase
- Problema → Solução → Diferencial → Prova social

### Execução
- Script Python com ReportLab gerando PDF profissional com visual Dark Tech (paleta do app)
- Output: `/mnt/documents/EVA_OS_Analise_Negocio.pdf`
- QA visual obrigatório

