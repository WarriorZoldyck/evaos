# Resumo da reunião — pendências a implementar

Da transcrição, os itens de Metas (categoria automática, modo anual) e Precificação (lucratividade fixa na quantidade, 5 linhas, botão editar, scroll, calendário no topo) já foram implementados, assim como as taxas da maquininha na calculadora de parcelamento. O que sobrou como novo escopo:

## 1. Precificação de produtos (novo módulo/tipo)

Demanda do cliente: calcular preço de **produtos** (ex.: café), hoje a Precificação V2 é focada em serviços/procedimentos.

- Novo tipo "Produto" na Precificação V2:
  - **CMV (Custo da Mercadoria Vendida)**: ingredientes/insumos com quantidade e custo unitário por porção/unidade.
  - Margem, impostos/taxas e comissões sobre o preço.
  - **Ponto de equilíbrio**: quantas unidades precisa vender no mês para cobrir os custos fixos (usando os custos fixos já cadastrados na precificação).
- Sem controle de estoque nesta etapa (fica para depois, conforme conversa).

## 2. Relatórios/Análise — gráficos visuais

Na área contábil (DRE/Fluxo), adicionar gráficos "bonitos" opcionais que o usuário possa ativar (visão menos seca), sem mudar os cálculos.

## 3. Planos — conferir desconto do anual

Verificar se o plano anual está aplicando o desconto prometido (12× R$139,90 → R$1.399) automaticamente no checkout Asaas, sem necessidade de cupom; corrigir se não estiver.

## 4. Cadastro — confirmação de e-mail

Investigar: usuário logou sem confirmar e-mail e confirmação pode cair em página em branco. Garantir fluxo `/auth/callback` funcionando e login só após confirmação (se essa for a política desejada).

## Detalhes técnicos

- Produtos: nova tabela (ou flag `kind: 'service' | 'product'` em `pricing_procedures`) com itens de insumo (nome, unidade, qtd por produto, custo unitário) e cálculo de CMV em `src/lib/installmentPricing.ts`-adjacent (nova lib pura com testes).
- Ponto de equilíbrio: `custosFixosMensais / (preço - custo variável unitário)` — lib pura + card na tela.
- Gráficos: Recharts com tokens semânticos do tema, opt-in por toggle na página.
- Anual: revisar `asaas-create-subscription` para billingType YEARLY com valor com desconto.
- Auth: revisar `src/pages/AuthCallback.tsx` e configuração "Confirm email" no Supabase.
