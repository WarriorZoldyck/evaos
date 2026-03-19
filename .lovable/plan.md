

## Atualizar credenciais da Evolution API e reconfigurar webhook

### Dados recebidos
- **EVOLUTION_INSTANCE**: `EVA OS`
- **EVOLUTION_API_KEY**: `28DFD3D281BE-45D5-A779-E499E570C58A`
- **EVOLUTION_API_URL**: mantém a mesma

### Plano

1. **Atualizar secrets no Supabase** — Substituir `EVOLUTION_INSTANCE` e `EVOLUTION_API_KEY` com os novos valores

2. **Reconfigurar webhook** — Chamar a edge function `evolution-webhook-config` via POST para registrar o webhook na nova instância com `MESSAGES_UPSERT`

3. **Verificar** — Consultar via GET para confirmar que a nova instância está com o webhook ativo

### Arquivos
- Nenhuma alteração de código necessária, apenas atualização de secrets e execução da function existente

