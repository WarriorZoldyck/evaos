

## Plano: Regenerar PDF corrigido no formato original

### Problemas identificados no PDF atual (v1 anexado)

1. **"Franquia" aparece em 6+ lugares** -- precisa ser "Empresarial" em todos (tabela de planos, unit economics, projeção de receita, LTV/CAC)
2. **Custos de infra com valores fictícios** -- Supabase $25/mês, Bandwidth $5-15, etc. ainda aparecem na seção 3.1. Devem virar "— A ser mapeado"
3. **Preços inconsistentes** -- PDF mostra R$49/R$99/R$199, mas o acordado foi R$47/R$97/R$197
4. **Sem logo** -- A capa não tem a logo da EVA OS, só texto
5. **Recalcular unit economics** -- com preços corretos (R$47/R$97/R$197) e sem custos de infra fixos

### O que será feito

**Regenerar `EVA_OS_Analise_Negocio_v2.pdf`** com:

- **Mesmo layout visual** do v1: fundo escuro (#0B1120), títulos em ciano (#48CAE4), tabelas com header dark, separadores, cards de destaque
- **Logo EVA OS** (`src/assets/eva-os-logo.jpeg`) na capa
- **"Franquia" → "Empresarial"** em todas as ocorrências
- **Seção 3.1 Infraestrutura**: valores substituídos por "— A ser mapeado"
- **Preços corrigidos**: Starter R$0, Pro R$47, Clínica R$97, Empresarial R$197
- **Unit economics recalculados** com os preços corretos
- **Seção 3.2 (custos IA)**: mantida intacta (dados reais confirmados)
- **QA visual** em todas as 7 páginas antes de entregar

### Arquivo gerado
- `/mnt/documents/EVA_OS_Analise_Negocio_v2.pdf`

