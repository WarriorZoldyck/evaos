

## Plano: Renomear tier "Franquia" → "Empresarial" + Atualizar PDF v2

### Mudanças

**1. Landing page (`src/components/landing/LandingPricing.tsx`)**
- Renomear o 4º plano de "Franquia" para "Empresarial"
- Atualizar descrição para "Para empresas com múltiplas unidades e equipes"
- CTA: "Assinar Empresarial"

**2. PDF de análise de negócio — gerar `EVA_OS_Analise_Negocio_v2.pdf`**
- Substituir todas as referências de "Franquia" por "Empresarial"
- Manter análise de mercado atualizada com os concorrentes dos screenshots (Conta Azul, Mordomize, MeuAssessor)
- Incluir custos reais de IA já levantados (255 interações, ~R$0.28/usuário/mês)
- Recalcular unit economics com os preços revisados (Starter grátis, Pro R$47, Clínica R$97, Empresarial R$197)
- Visual Dark Tech mantido

### Arquivos afetados
- `src/components/landing/LandingPricing.tsx` — rename do plano
- `/mnt/documents/EVA_OS_Analise_Negocio_v2.pdf` — novo documento gerado

