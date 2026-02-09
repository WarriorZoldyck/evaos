

## Correção: Loop Infinito ao Salvar Configuração na Precificação

### Causa Raiz

O hook `usePricing` tem uma dependência circular nos `useCallback`/`useEffect`:

```text
saveConfig
  -> fetchConfig() -> setConfig(newValue)
  -> config muda
  -> fetchCosts recria (porque config está nas deps do useCallback)
  -> useEffect detecta novo fetchCosts
  -> useEffect roda init() de novo
  -> fetchConfig -> setConfig -> config muda -> fetchCosts recria -> useEffect roda...
  -> LOOP INFINITO
```

### Solução

Remover `config` da lista de dependências de `fetchCosts` e usar um `useRef` para acessar o valor atual de `config` sem causar recriação das funções.

**Arquivo:** `src/hooks/usePricing.ts`

1. Adicionar um `configRef` com `useRef` que é sincronizado com `config` via um `useEffect` separado
2. Dentro de `fetchCosts`, ler `configRef.current` em vez de `config` diretamente
3. Alterar as dependências de `fetchCosts` para `[user]` apenas (removendo `config`)
4. Isso quebra o ciclo: `saveConfig` -> `fetchConfig` -> `setConfig` já nao recria `fetchCosts`, então o `useEffect` de init nao dispara novamente

### Mudança concreta

```text
// ANTES (linha 181):
}, [user, config]);

// DEPOIS:
}, [user]);

// + adicionar useRef para config
const configRef = useRef<PricingConfig | null>(null);
useEffect(() => { configRef.current = config; }, [config]);

// Dentro de fetchCosts, trocar:
const currentConfig = config;
// por:
const currentConfig = configRef.current;
```

Nenhum outro arquivo precisa ser alterado. A correção é cirúrgica no hook.
