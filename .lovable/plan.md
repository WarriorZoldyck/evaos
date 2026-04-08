

# Ajustes na Precificação V1

## 2 mudanças

### 1. Remover emoji "💰" do Preço Sugerido
Na linha 85 de `SuggestedPriceCalculator.tsx`, trocar `💰 Preço Sugerido` por apenas `Preço Sugerido` (sem emoji).

### 2. Tornar os valores do resultado editáveis na Calculadora
Hoje os valores de CF, CV e NF no painel de resultado são texto estático. A ideia é permitir que o usuário edite diretamente esses valores para simular cenários — similar ao "E se?".

Campos que passam a ser editáveis inline:
- **CF** (custo fixo): o usuário pode sobrescrever o valor calculado de `custoHora × tempo`
- **CV** (materiais): já é editável no input acima, mas adicionar edição inline também no painel de resultado
- **NF** (alíquota): permitir ajustar o valor de imposto diretamente

Ao editar inline, o cálculo se ajusta em tempo real. Um botão de "resetar" restaura os valores calculados originais.

### Arquivos afetados

| Arquivo | Mudança |
|---------|---------|
| `src/components/precificacao-v2/SuggestedPriceCalculator.tsx` | Remover emoji, tornar CF/CV/NF editáveis inline com estados de override e botão de reset |

