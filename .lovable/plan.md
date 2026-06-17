## Causa raiz

Os boletos da Neodent caem em **RENATO BRUGGEMANN (PF)** porque a IA segue, nesta ordem, a detecção de contexto definida em `whatsapp-webhook/index.ts` (linhas 1771-1781):

1. CNPJ/razão do **destinatário do documento** → empresa do usuário
2. **Padrões históricos** (90 dias) — onde Neodent aparece majoritariamente em RENATO BRUGGEMANN
3. Fallback Pessoal

O fornecedor **Neodent (JJGC, supplier_id `019d1748-…`) já está cadastrado e vinculado a IMPLANTES BR LTDA**, mas essa informação não é usada como sinal forte. Hoje o supplier só entra na resolução *depois* da IA escolher o contexto — então ela escolhe pelo histórico/destinatário e ignora o vínculo do fornecedor.

## Mudança proposta — priorizar fornecedor cadastrado

Ajustar a detecção de contexto para que, **se a IA identificar (via nome ou CNPJ no documento/mensagem) um fornecedor cadastrado que tenha `company_id` definido**, ela use AUTOMATICAMENTE o contexto desse fornecedor — sobrescrevendo padrões históricos. Apenas a regra de "CNPJ do destinatário = empresa do usuário" continua acima (já que isso é evidência direta do tomador).

### Nova ordem de precedência

1. CNPJ/razão do **destinatário** do documento bate com empresa do usuário → usa essa empresa
2. **(NOVO)** Fornecedor identificado (supplier match por nome/CNPJ no emissor/itens) tem `company_id` definido → usa o contexto do fornecedor
3. Cartão de crédito identificado → usa contexto do cartão (regra atual)
4. Padrões históricos
5. Fallback Pessoal

## Implementação técnica

### 1. `supabase/functions/whatsapp-webhook/index.ts`

**a)** No bloco que monta `suppliersList` (~linha 1620-1650), incluir o `company_id` de cada fornecedor no texto enviado à IA. Exemplo:
```
FORNECEDORES CADASTRADOS (NOME → CONTEXTO PADRÃO):
- "JJGC Indústria…" (CNPJ 12345…) → contexto: "IMPLANTES BR LTDA"
- "Aromas Grill" → contexto: "Pessoal"
```

**b)** Adicionar nova seção de regras logo após "REGRA CRÍTICA DE DETECÇÃO DE CONTEXTO POR DOCUMENTO" (~linha 1781):
```
REGRA CRÍTICA — CONTEXTO POR FORNECEDOR CADASTRADO:
- Se o EMITENTE/MERCHANT identificado (por nome, CNPJ, razão social ou itens da NF) corresponder a um fornecedor da lista FORNECEDORES CADASTRADOS, e esse fornecedor tiver um "contexto: <Empresa>" definido, USE esse contexto AUTOMATICAMENTE.
- Esta regra TEM PRIORIDADE sobre padrões históricos.
- Exceção única: se o CNPJ do DESTINATÁRIO do documento bater com outra empresa do usuário, o destinatário vence (regra acima).
- Match permitido: nome contém / CNPJ exato / razão social normalizada.
```

**c)** Após receber a resposta da IA (`txPayload`), adicionar um **safety-net server-side**: se `supplier_id` resolvido pelo matcher de fornecedores existir e tiver `company_id`, e o `txPayload.context` resolvido for diferente do `company_id` do fornecedor **e** não veio de match de destinatário (heurística: `extractedDocument.recipient_cnpj` não bateu com nenhuma empresa), sobrescrever `companyId` para o do fornecedor. Logar a sobrescrita.

### 2. Tabela `suppliers`

Verificar se `suppliers.company_id` já existe. Se não, criar migration adicionando coluna nullable `company_id uuid references companies(id)` e respeitar RLS atual.

(Confirmar antes na fase de build — provavelmente já existe, pois fornecedores hoje são cadastrados por contexto.)

### 3. UI — sem mudanças necessárias

O usuário já cadastra fornecedor com contexto. Apenas garantir que o seletor de "contexto padrão" do fornecedor está claro na tela `Contatos` (verificar; se faltar, adicionar campo).

## Verificação

- Reenviar um boleto Neodent pelo WhatsApp → deve cair em **IMPLANTES BR LTDA**
- Enviar boleto de outro fornecedor cadastrado em outro contexto → respeita o contexto do fornecedor
- Enviar lançamento livre ("paguei 50 no posto") sem fornecedor cadastrado → continua usando padrões históricos / Pessoal
- Logs do edge function devem mostrar a fonte da decisão de contexto

## Fora de escopo

- **Histórico não será alterado.** Lançamentos antigos da Neodent em RENATO BRUGGEMANN permanecem como estão.
- Detecção de cartão de crédito (já funciona).
- Outras heurísticas (categorias, contas).

## Memória

Atualizar `mem://whatsapp/automatic-context-detection` adicionando a nova prioridade: "Fornecedor cadastrado com company_id vence padrão histórico".
