

## Plano: Remover custos não-mapeados do PDF de Análise

### O que muda

No documento `EVA_OS_Analise_Negocio_v2.pdf`, na seção de **Custos Operacionais**:

- **Remover** valores específicos de Supabase (~$25/mês), Lovable, e qualquer outro custo de infraestrutura que ainda não foi validado
- **Substituir** por "—" (travessão) com nota "A ser mapeado"
- **Manter** apenas os custos reais já confirmados: custo de IA por interação (~R$0.28/usuário/mês baseado em uso real)
- **Recalcular** unit economics sem os custos de infra — deixar margem como "A definir após mapeamento completo" onde depender desses valores

### Execução
- Regenerar `EVA_OS_Analise_Negocio_v2.pdf` com mesmo visual Dark Tech
- QA visual obrigatório em todas as páginas

### Arquivo afetado
- `/mnt/documents/EVA_OS_Analise_Negocio_v2.pdf` — atualizado

