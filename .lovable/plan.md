
## Cadastro Interativo de Cartao de Credito (Frente e Verso)

Substituir o formulario generico atual do cartao de credito por um componente skeuomorfico 3D que simula um cartao fisico real, com animacao de flip (frente/verso) conforme o usuario preenche os campos.

### Experiencia do Usuario

O usuario vera um cartao de credito 3D centralizado no modal. Conforme preenche os campos, o cartao atualiza em tempo real. Ao completar os campos da frente, o cartao vira automaticamente para o verso com uma animacao CSS 3D flip. O usuario tambem pode clicar para virar manualmente.

**Frente do cartao:**
- Nome do cartao (ex: "Nubank Platinum") -- campo editavel inline
- Ultimos 4 digitos formatados como "**** **** **** 1234"
- Chip decorativo (SVG/CSS)
- Bandeira/logo decorativo
- Gradiente de fundo estilizado

**Verso do cartao:**
- Tarja magnetica decorativa (faixa preta)
- Dia de fechamento
- Dia de vencimento
- Limite (R$)
- Conta bancaria vinculada (select)

### Interatividade

1. Modal abre com o cartao na frente
2. Usuario digita o nome do cartao e os 4 digitos -- aparecem no cartao em tempo real
3. Ao preencher os 4 digitos (ou clicar no botao "Virar"), o cartao faz flip 3D para o verso
4. No verso, usuario preenche fechamento, vencimento, limite e conta vinculada
5. Botoes "Cancelar" e "Salvar" ficam abaixo do cartao

### Detalhes Tecnicos

**Arquivo criado:**
- `src/components/contas/CreditCardFormModal.tsx` -- Novo componente dedicado para o cartao

**Arquivo modificado:**
- `src/pages/Contas.tsx` -- Importar e usar `CreditCardFormModal` quando `activeTab === "card"` em vez do `AccountFormModal`
- `src/components/contas/AccountFormModal.tsx` -- Remover a secao `tab === "card"` (opcional, pois nao sera mais chamado para cards)

**Tecnicas CSS utilizadas:**
- `perspective` e `transform: rotateY(180deg)` para o flip 3D
- `backface-visibility: hidden` para esconder o lado oposto
- `transition: transform 0.6s` para animacao suave
- Gradiente de fundo inspirado em cartoes reais (tons escuros com brilho metalico)
- Chip dourado em CSS puro (retangulo arredondado com gradiente gold)

**Estrutura do componente:**

```text
+------------------------------------------+
|  Dialog (bg transparente, sem bordas)    |
|                                          |
|  +------------------------------------+  |
|  |  CARTAO 3D (container perspective) |  |
|  |                                    |  |
|  |  [FRENTE]         [VERSO]          |  |
|  |  - Chip dourado   - Tarja preta    |  |
|  |  - Nome cartao    - Fechamento     |  |
|  |  - **** 1234      - Vencimento     |  |
|  |  - Bandeira       - Limite         |  |
|  |                   - Conta vinculada|  |
|  +------------------------------------+  |
|                                          |
|  [Virar]   [Cancelar]   [Salvar]        |
+------------------------------------------+
```

**Props:** Mesmo contrato do formulario atual (`editData`, `onSave`, `bankAccounts`, etc.) para manter compatibilidade total.

**Dados salvos:** Identicos ao formulario atual -- `name`, `bank_account_id`, `closing_day`, `due_day`, `limit`, `last_four_digits`.
