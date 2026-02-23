import { useEffect, useRef, useState, useCallback } from "react";
import {
  LayoutDashboard, ArrowLeftRight, BarChart3, FileText, Calculator,
  CreditCard, FolderTree, Users, Settings, BookOpen, Lightbulb,
  Building2, User, MessageSquare, Code, Send, AlertTriangle,
  CheckCircle2, Repeat, Wallet, ChevronDown, Copy, Check, Terminal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface NavGroup {
  label: string;
  items: { id: string; title: string; icon: React.ElementType }[];
}

const navGroups: NavGroup[] = [
  {
    label: "Início",
    items: [
      { id: "overview", title: "Visão Geral", icon: Lightbulb },
      { id: "contexts", title: "Contextos", icon: Building2 },
    ],
  },
  {
    label: "Cadastros",
    items: [
      { id: "accounts", title: "Contas & Cartões", icon: CreditCard },
      { id: "categories", title: "Categorias", icon: FolderTree },
      { id: "contacts", title: "Contatos", icon: Users },
    ],
  },
  {
    label: "Operações",
    items: [
      { id: "transactions", title: "Lançamentos", icon: ArrowLeftRight },
      { id: "credit-card-bill", title: "Fatura de Cartão", icon: CreditCard },
    ],
  },
  {
    label: "Relatórios",
    items: [
      { id: "dashboard", title: "Dashboard", icon: LayoutDashboard },
      { id: "cashflow", title: "Plano de Caixa", icon: BarChart3 },
      { id: "dre", title: "DRE", icon: FileText },
    ],
  },
  {
    label: "Ferramentas",
    items: [
      { id: "pricing", title: "Precificação", icon: Calculator },
      { id: "settings", title: "Configurações", icon: Settings },
    ],
  },
  {
    label: "API & Integrações",
    items: [
      { id: "whatsapp-api", title: "WhatsApp (EVA)", icon: MessageSquare },
    ],
  },
];

const allIds = navGroups.flatMap((g) => g.items.map((i) => i.id));

/* ------------------------------------------------------------------ */
/*  Code Block component                                               */
/* ------------------------------------------------------------------ */

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 rounded-md bg-background/80 hover:bg-background border text-muted-foreground hover:text-foreground transition-colors"
      title="Copiar"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function CodeBlock({ children, title, copyable = true }: { children: string; title?: string; copyable?: boolean }) {
  return (
    <div className="my-3">
      {title && <p className="text-xs font-medium text-foreground mb-1">{title}</p>}
      <div className="relative">
        <pre className="bg-muted rounded-lg p-4 pr-10 font-mono text-xs overflow-x-auto whitespace-pre text-foreground/80">
          {children}
        </pre>
        {copyable && <CopyButton text={children} />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export default function Docs() {
  const [activeId, setActiveId] = useState("overview");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  /* Intersection Observer for scroll spy */
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { root: container, rootMargin: "-10% 0px -80% 0px", threshold: 0 }
    );

    allIds.forEach((id) => {
      const el = sectionRefs.current[id];
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const scrollTo = useCallback((id: string) => {
    const el = sectionRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveId(id);
    }
  }, []);

  const setRef = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      sectionRefs.current[id] = el;
    },
    []
  );

  /* ---- Sidebar (desktop) or dropdown (mobile) ---- */

  const SidebarNav = () => (
    <nav className="space-y-5">
      {navGroups.map((group) => (
        <div key={group.label}>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5 px-2">
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = activeId === item.id;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => scrollTo(item.id)}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors text-left",
                      active
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{item.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  /* Mobile select */
  const MobileNav = () => {
    const current = navGroups.flatMap((g) => g.items).find((i) => i.id === activeId);
    const [open, setOpen] = useState(false);

    return (
      <div className="relative mb-4">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border bg-card text-sm font-medium"
        >
          <span className="flex items-center gap-2">
            {current && <current.icon className="h-4 w-4 text-primary" />}
            {current?.title ?? "Navegação"}
          </span>
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </button>
        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-lg border bg-card shadow-lg p-2 max-h-72 overflow-y-auto">
            {navGroups.map((group) => (
              <div key={group.label} className="mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 px-2 mb-1">
                  {group.label}
                </p>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { scrollTo(item.id); setOpen(false); }}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm",
                        activeId === item.id ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {item.title}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  /* ---- Section helper ---- */

  const Section = ({ id, title, icon: Icon, badge, children }: {
    id: string; title: string; icon: React.ElementType; badge?: string; children: React.ReactNode;
  }) => (
    <section ref={setRef(id)} id={id} className="scroll-mt-4 pb-10">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="h-4.5 w-4.5 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">{title}</h2>
        {badge && <Badge variant="secondary" className="text-[10px]">{badge}</Badge>}
      </div>
      <div className="text-sm text-muted-foreground space-y-3 leading-relaxed">
        {children}
      </div>
      <Separator className="mt-8" />
    </section>
  );

  /* ================================================================ */
  /*  RENDER                                                           */
  /* ================================================================ */

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-display text-foreground flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          Documentação
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Aprenda como utilizar todas as funcionalidades do EVA OS.
        </p>
      </div>

      {isMobile && <MobileNav />}

      <div className="flex gap-8">
        {/* Sidebar — desktop only */}
        {!isMobile && (
          <aside className="w-56 shrink-0 sticky top-0 self-start">
            <ScrollArea className="h-[calc(100vh-10rem)]">
              <SidebarNav />
            </ScrollArea>
          </aside>
        )}

        {/* Content */}
        <div ref={scrollContainerRef} className="flex-1 min-w-0 max-w-3xl overflow-y-auto h-[calc(100vh-10rem)] pr-2">
          {/* ---- Visão Geral ---- */}
          <Section id="overview" title="Visão Geral do EVA OS" icon={Lightbulb}>
            <p>
              O <strong className="text-foreground">EVA OS</strong> é um sistema de gestão financeira completo para controle de receitas, despesas,
              contas bancárias, cartões de crédito, carteiras, fornecedores e clientes.
            </p>
            <p>Principais recursos:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Dashboard</strong> — visão geral do período com cards de resumo, gráficos por categoria e projeção de saldo</li>
              <li><strong className="text-foreground">Lançamentos</strong> — CRUD completo de receitas e despesas, com parcelamento, recorrências e transferências</li>
              <li><strong className="text-foreground">Plano de Caixa</strong> — fluxo de caixa por período com entradas e saídas</li>
              <li><strong className="text-foreground">DRE</strong> — Demonstrativo de Resultados por competência</li>
              <li><strong className="text-foreground">Precificação</strong> — cálculo de preço por procedimento/serviço com custos e margem</li>
              <li><strong className="text-foreground">WhatsApp (EVA)</strong> — assistente financeira via WhatsApp com IA</li>
            </ul>
          </Section>

          {/* ---- Contextos ---- */}
          <Section id="contexts" title="Contextos: Pessoal vs Empresas" icon={Building2}>
            <p>O EVA OS permite separar suas finanças pessoais das finanças de cada empresa cadastrada.</p>
            <p>Use o <strong className="text-foreground">seletor de contexto</strong> na barra lateral para alternar entre:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><User className="inline h-3.5 w-3.5 mr-1" /><strong className="text-foreground">Pessoal</strong> — finanças individuais, sem CNPJ vinculado</li>
              <li><Building2 className="inline h-3.5 w-3.5 mr-1" /><strong className="text-foreground">Empresa</strong> — finanças separadas por CNPJ. Cadastre empresas em Configurações</li>
            </ul>
            <p className="text-xs text-muted-foreground/70 mt-2">Todos os dados (contas, categorias, lançamentos) são filtrados pelo contexto ativo.</p>
          </Section>

          {/* ---- Contas ---- */}
          <Section id="accounts" title="Contas, Carteiras e Cartões" icon={CreditCard} badge="Cadastro">
            <p>Em <strong className="text-foreground">Contas & Cartões</strong> você gerencia:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-foreground">Contas Bancárias</strong> — Corrente ou Poupança, com saldo inicial. É a conta de saída ao liquidar lançamentos.</li>
              <li><strong className="text-foreground">Carteiras (Wallets)</strong> — Para controlar dinheiro em espécie ou contas informais.</li>
              <li><strong className="text-foreground">Cartões de Crédito</strong> — Vinculados a uma conta bancária. Defina dia de fechamento e vencimento para cálculo automático do ciclo de fatura.</li>
              <li><strong className="text-foreground">Maquininhas</strong> — Terminais de cartão com taxas de débito/crédito e prazo de recebimento.</li>
            </ul>
          </Section>

          {/* ---- Categorias ---- */}
          <Section id="categories" title="Categorias e Subcategorias" icon={FolderTree} badge="Cadastro">
            <p>Organize suas finanças com categorias hierárquicas de até <strong className="text-foreground">3 níveis</strong> (categoria → subcategoria → sub-subcategoria).</p>
            <p>Cada categoria pode ser do tipo:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Receita</strong> — aparece apenas em lançamentos de receita</li>
              <li><strong className="text-foreground">Despesa</strong> — apenas em despesas</li>
              <li><strong className="text-foreground">Ambos</strong> — disponível em receitas e despesas</li>
            </ul>
            <p className="mt-2">As categorias alimentam o <strong className="text-foreground">DRE</strong> e os gráficos do <strong className="text-foreground">Dashboard</strong>.</p>
          </Section>

          {/* ---- Contatos ---- */}
          <Section id="contacts" title="Fornecedores e Clientes" icon={Users} badge="Cadastro">
            <p>
              Cadastre fornecedores e clientes com nome e CPF/CNPJ. Eles podem ser vinculados a lançamentos
              para rastreabilidade. Útil para filtrar e gerar relatórios por contato.
            </p>
          </Section>

          {/* ---- Lançamentos ---- */}
          <Section id="transactions" title="Lançamentos" icon={ArrowLeftRight} badge="Principal">
            <p>Tela central do sistema. Cada lançamento é uma <strong className="text-foreground">receita</strong> ou <strong className="text-foreground">despesa</strong> com:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Descrição, valor, data de pagamento e competência</li>
              <li>Categoria e subcategorias (até 3 níveis)</li>
              <li>Conta/carteira/cartão vinculado</li>
              <li>Fornecedor ou cliente</li>
              <li>Status: <Badge variant="secondary" className="text-[10px]">Pendente</Badge> ou <Badge className="text-[10px]">Liquidado</Badge></li>
            </ul>
            <Separator className="my-3" />
            <p className="font-medium text-foreground flex items-center gap-1"><Repeat className="h-3.5 w-3.5" /> Parcelamentos</p>
            <p>
              Ao parcelar, defina o número de parcelas, taxa de juros e opcionalmente um <strong className="text-foreground">valor de entrada</strong>
              (1ª parcela maior, restante distribuído igualmente).
            </p>
            <Separator className="my-3" />
            <p className="font-medium text-foreground">Recorrências</p>
            <p>Crie lançamentos recorrentes (mensal, semanal, anual) que se repetem automaticamente. Cada ocorrência pode ser editada individualmente.</p>
            <Separator className="my-3" />
            <p className="font-medium text-foreground flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Liquidação</p>
            <p>Ao liquidar, informe o valor efetivamente pago. Se diferir do previsto, o sistema oferece opções:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Descartar</strong> a diferença</li>
              <li><strong className="text-foreground">Criar pendente</strong> com o saldo restante</li>
              <li><strong className="text-foreground">Aplicar juros/multa</strong> sobre o saldo</li>
              <li><strong className="text-foreground">Redistribuir</strong> entre parcelas restantes (se for série)</li>
            </ul>
          </Section>

          {/* ---- Fatura ---- */}
          <Section id="credit-card-bill" title="Pagamento de Fatura de Cartão" icon={CreditCard} badge="Fluxo">
            <p>O sistema calcula automaticamente o <strong className="text-foreground">ciclo de fatura</strong> com base no dia de fechamento e vencimento do cartão.</p>
            <p><strong className="text-foreground">Fluxo de pagamento:</strong></p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Filtre por cartão em Lançamentos ou acesse pela tela de Contas</li>
              <li>Revise os lançamentos da fatura do mês</li>
              <li>Informe o valor do pagamento (integral, parcial ou excedente)</li>
              <li>Para pagamento parcial, escolha o que fazer com o saldo:
                <ul className="list-disc pl-5 mt-1 space-y-0.5">
                  <li>Rolar para próxima fatura (sem juros)</li>
                  <li>Rolar com juros (rotativo)</li>
                  <li>Criar lançamento avulso</li>
                </ul>
              </li>
            </ol>
          </Section>

          {/* ---- Dashboard ---- */}
          <Section id="dashboard" title="Dashboard" icon={LayoutDashboard}>
            <p>Visão consolidada do período selecionado:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Cards de resumo</strong> — Receitas, Despesas, Resultado e Saldo</li>
              <li><strong className="text-foreground">Gráficos por categoria</strong> — Receita e despesa em pizza/barras</li>
              <li><strong className="text-foreground">Projeção de saldo</strong> — Gráfico de linha com saldo acumulado</li>
              <li><strong className="text-foreground">Próximos lançamentos</strong> — Transações pendentes mais próximas</li>
            </ul>
            <p className="mt-2">Clique em qualquer card ou fatia de gráfico para navegar direto aos lançamentos filtrados (drill-down).</p>
          </Section>

          {/* ---- Plano de Caixa ---- */}
          <Section id="cashflow" title="Plano de Caixa" icon={BarChart3}>
            <p>
              Relatório de fluxo de caixa por período. Mostra entradas e saídas agrupadas por mês/semana,
              com totais acumulados para visualizar a evolução do caixa ao longo do tempo.
            </p>
          </Section>

          {/* ---- DRE ---- */}
          <Section id="dre" title="DRE — Demonstrativo de Resultado" icon={FileText}>
            <p>
              Relatório de resultado por <strong className="text-foreground">competência</strong> (não por data de pagamento).
              Agrupa receitas e despesas por categoria, mostrando o resultado líquido.
            </p>
            <p>
              As seções de Receitas e Despesas são <strong className="text-foreground">colapsáveis</strong>. Clique em uma categoria
              para expandir suas subcategorias.
            </p>
          </Section>

          {/* ---- Precificação ---- */}
          <Section id="pricing" title="Precificação de Serviços" icon={Calculator}>
            <p>Calcule o preço ideal de cada procedimento/serviço baseado em:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Custos fixos mensais (extraídos das despesas)</li>
              <li>Horas trabalhadas por mês</li>
              <li>Tempo de execução do procedimento</li>
              <li>Materiais e insumos específicos</li>
              <li>Margem de lucro desejada</li>
            </ul>
            <p className="mt-2">
              O sistema calcula o <strong className="text-foreground">preço mínimo</strong> (custo) e o <strong className="text-foreground">preço sugerido</strong> (com margem).
            </p>
          </Section>

          {/* ---- Configurações ---- */}
          <Section id="settings" title="Configurações" icon={Settings}>
            <p>Em Configurações você pode:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Gerenciar empresas (adicionar/editar CNPJ)</li>
              <li>Personalizar campos visíveis no formulário de lançamento</li>
              <li>Alterar tema (claro/escuro)</li>
              <li>Gerenciar perfil e dados da conta</li>
              <li>Cadastrar seu número de WhatsApp para integração com a EVA</li>
            </ul>
          </Section>

          {/* ================================================================ */}
          {/*  API WhatsApp (EVA)                                               */}
          {/* ================================================================ */}
          <Section id="whatsapp-api" title="API WhatsApp (EVA)" icon={MessageSquare} badge="API">
            {/* Visão geral */}
            <p>
              A <strong className="text-foreground">EVA</strong> é uma assistente financeira inteligente integrada ao WhatsApp.
              Ela permite criar lançamentos, consultar saldos, gastos e receitas — tudo por mensagens de texto ou fotos de notas fiscais.
            </p>
            <p>
              A comunicação é feita via um <strong className="text-foreground">webhook</strong> (Edge Function) que recebe mensagens do WhatsApp
              através de integrações como <strong className="text-foreground">n8n + uazapi</strong> ou qualquer plataforma que envie HTTP POST.
            </p>

            <Separator className="my-4" />

            {/* Endpoint */}
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2 mb-2">
              <Code className="h-4 w-4" /> Endpoint
            </h3>
            <CodeBlock>{`POST https://<supabase-project>.supabase.co/functions/v1/whatsapp-webhook`}</CodeBlock>

            <h3 className="text-base font-semibold text-foreground flex items-center gap-2 mt-5 mb-2">
              <AlertTriangle className="h-4 w-4" /> Autenticação
            </h3>
            <p>O webhook é protegido pelo header <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">x-webhook-secret</code>.</p>
            <CodeBlock title="Header obrigatório">{`x-webhook-secret: <WHATSAPP_WEBHOOK_SECRET>`}</CodeBlock>
            <p className="text-xs text-muted-foreground/70">
              O secret é configurado como variável de ambiente na Edge Function. Requisições sem esse header retornam <code className="font-mono">401 Unauthorized</code>.
            </p>

            <Separator className="my-4" />

            {/* Payload */}
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2 mb-2">
              <Send className="h-4 w-4" /> Payload da Requisição
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-semibold text-foreground">Campo</th>
                    <th className="text-left py-2 pr-4 font-semibold text-foreground">Tipo</th>
                    <th className="text-left py-2 pr-4 font-semibold text-foreground">Obrigatório</th>
                    <th className="text-left py-2 font-semibold text-foreground">Descrição</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4">phone</td>
                    <td className="py-2 pr-4 text-muted-foreground">string</td>
                    <td className="py-2 pr-4"><Badge className="text-[9px]">Sim</Badge></td>
                    <td className="py-2 font-sans">Número do WhatsApp do usuário (deve estar cadastrado no perfil)</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4">message</td>
                    <td className="py-2 pr-4 text-muted-foreground">string</td>
                    <td className="py-2 pr-4"><Badge variant="secondary" className="text-[9px]">Condicional</Badge></td>
                    <td className="py-2 font-sans">Texto da mensagem (obrigatório se não houver imagem)</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4">image_base64</td>
                    <td className="py-2 pr-4 text-muted-foreground">string</td>
                    <td className="py-2 pr-4"><Badge variant="outline" className="text-[9px]">Não</Badge></td>
                    <td className="py-2 font-sans">Imagem em base64 (ex: foto de nota fiscal)</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">image_url</td>
                    <td className="py-2 pr-4 text-muted-foreground">string</td>
                    <td className="py-2 pr-4"><Badge variant="outline" className="text-[9px]">Não</Badge></td>
                    <td className="py-2 font-sans">URL pública de imagem (alternativa ao base64)</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <Separator className="my-4" />

            {/* cURL pronto */}
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2 mb-2">
              <Terminal className="h-4 w-4" /> cURL Pronto para Uso
            </h3>
            <p>Copie e cole no terminal para testar a API rapidamente. Substitua os valores entre <code className="bg-muted px-1 rounded text-xs font-mono">&lt;...&gt;</code>.</p>

            <CodeBlock title="Criar lançamento">{`curl -X POST \\
  https://<SUPABASE_PROJECT>.supabase.co/functions/v1/whatsapp-webhook \\
  -H "Content-Type: application/json" \\
  -H "x-webhook-secret: <SEU_SECRET>" \\
  -d '{
    "phone": "5511999999999",
    "message": "Gastei 50 reais no almoço"
  }'`}</CodeBlock>

            <CodeBlock title="Consultar saldo">{`curl -X POST \\
  https://<SUPABASE_PROJECT>.supabase.co/functions/v1/whatsapp-webhook \\
  -H "Content-Type: application/json" \\
  -H "x-webhook-secret: <SEU_SECRET>" \\
  -d '{
    "phone": "5511999999999",
    "message": "Qual meu saldo?"
  }'`}</CodeBlock>

            <CodeBlock title="Enviar imagem de nota fiscal">{`curl -X POST \\
  https://<SUPABASE_PROJECT>.supabase.co/functions/v1/whatsapp-webhook \\
  -H "Content-Type: application/json" \\
  -H "x-webhook-secret: <SEU_SECRET>" \\
  -d '{
    "phone": "5511999999999",
    "message": "Registrar essa nota",
    "image_url": "https://exemplo.com/nota-fiscal.jpg"
  }'`}</CodeBlock>

            <Separator className="my-4" />

            {/* Intenções */}
            <h3 className="text-base font-semibold text-foreground mb-2">Intenções Suportadas</h3>
            <p>A IA classifica cada mensagem em uma de três intenções:</p>

            {/* lancamento */}
            <div className="mt-4 p-4 rounded-lg border bg-card">
              <p className="font-semibold text-foreground flex items-center gap-2">
                <Badge className="text-[10px]">lancamento</Badge> Criar Lançamento
              </p>
              <p className="mt-1">
                A EVA extrai automaticamente: descrição, valor, tipo (receita/despesa), categoria, subcategoria e data.
                O lançamento é criado com status <code className="bg-muted px-1 rounded text-xs font-mono">Pago</code>.
              </p>
              <CodeBlock title="Exemplo de request">{`{
  "phone": "5511999999999",
  "message": "Gastei 45 reais no mercado hoje"
}`}</CodeBlock>
              <CodeBlock title="Resposta">{`{
  "success": true,
  "intent": "lancamento",
  "message": "✅ Lançamento criado!\\n\\n📝 Mercado\\n💰 R$ 45,00\\n📁 Despesa / Alimentação\\n📅 2026-02-23",
  "transaction": {
    "description": "Mercado",
    "amount": 45.00,
    "type": "despesa",
    "category": "Alimentação",
    "date": "2026-02-23"
  }
}`}</CodeBlock>
            </div>

            {/* consulta */}
            <div className="mt-4 p-4 rounded-lg border bg-card">
              <p className="font-semibold text-foreground flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">consulta</Badge> Consultar Dados
              </p>
              <p className="mt-1">Tipos de consulta suportados:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><code className="bg-muted px-1 rounded text-xs font-mono">saldo</code> — saldo de todas as contas e carteiras</li>
                <li><code className="bg-muted px-1 rounded text-xs font-mono">resumo_mes</code> — receitas, despesas, saldo e top categorias</li>
                <li><code className="bg-muted px-1 rounded text-xs font-mono">gastos_mes</code> — total de despesas do mês</li>
                <li><code className="bg-muted px-1 rounded text-xs font-mono">receitas_mes</code> — total de receitas do mês</li>
                <li><code className="bg-muted px-1 rounded text-xs font-mono">pendentes</code> — até 10 contas pendentes</li>
                <li><code className="bg-muted px-1 rounded text-xs font-mono">gastos_categoria</code> — gastos filtrados por categoria</li>
              </ul>
              <CodeBlock title="Exemplo de request">{`{
  "phone": "5511999999999",
  "message": "Qual meu saldo?"
}`}</CodeBlock>
              <CodeBlock title="Resposta">{`{
  "success": true,
  "intent": "consulta",
  "message": "💰 Saldo total: R$ 3.250,00\\n\\n  • Nubank: R$ 2.000,00\\n  • Carteira: R$ 1.250,00",
  "transaction": null
}`}</CodeBlock>
            </div>

            {/* conversa */}
            <div className="mt-4 p-4 rounded-lg border bg-card">
              <p className="font-semibold text-foreground flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">conversa</Badge> Conversa Geral
              </p>
              <p className="mt-1">Para mensagens que não são lançamentos nem consultas, a EVA responde de forma conversacional.</p>
              <CodeBlock title="Resposta">{`{
  "success": true,
  "intent": "conversa",
  "message": "Olá! Sou a EVA, sua assistente financeira. Posso ajudar com lançamentos e consultas!",
  "transaction": null
}`}</CodeBlock>
            </div>

            <Separator className="my-4" />

            {/* Códigos de erro */}
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4" /> Códigos de Erro
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4 font-semibold text-foreground">Status</th>
                    <th className="text-left py-2 font-semibold text-foreground">Descrição</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4 font-mono font-semibold text-destructive">401</td>
                    <td className="py-2">Header <code className="font-mono bg-muted px-1 rounded">x-webhook-secret</code> ausente ou inválido</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4 font-mono font-semibold text-destructive">400</td>
                    <td className="py-2">Payload inválido — <code className="font-mono bg-muted px-1 rounded">phone</code> e <code className="font-mono bg-muted px-1 rounded">message</code>/<code className="font-mono bg-muted px-1 rounded">image</code> são obrigatórios</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4 font-mono font-semibold text-destructive">404</td>
                    <td className="py-2">Número de WhatsApp não cadastrado no perfil do usuário</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono font-semibold text-destructive">500</td>
                    <td className="py-2">Erro interno (falha na IA, no banco de dados ou configuração)</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <Separator className="my-4" />

            {/* Configuração */}
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2 mb-2">
              <Settings className="h-4 w-4" /> Configuração
            </h3>
            <ol className="list-decimal pl-5 space-y-2">
              <li>
                <strong className="text-foreground">Cadastre seu número:</strong> Vá em{" "}
                <strong className="text-foreground">Configurações → WhatsApp</strong> e salve seu número no formato internacional (ex: <code className="bg-muted px-1 rounded text-xs font-mono">5511999999999</code>).
              </li>
              <li>
                <strong className="text-foreground">Configure o n8n ou automação:</strong> Crie um fluxo que receba mensagens do WhatsApp (via uazapi, Z-API, etc.)
                e envie um POST para o endpoint acima com os campos <code className="bg-muted px-1 rounded text-xs font-mono">phone</code> e <code className="bg-muted px-1 rounded text-xs font-mono">message</code>.
              </li>
              <li>
                <strong className="text-foreground">Defina o secret:</strong> Configure a variável de ambiente <code className="bg-muted px-1 rounded text-xs font-mono">WHATSAPP_WEBHOOK_SECRET</code> na Edge Function
                e use o mesmo valor no header <code className="bg-muted px-1 rounded text-xs font-mono">x-webhook-secret</code> do seu fluxo.
              </li>
              <li>
                <strong className="text-foreground">Teste:</strong> Envie uma mensagem pelo WhatsApp e verifique se o lançamento aparece no EVA OS.
              </li>
            </ol>
            <p className="mt-3 text-xs text-muted-foreground/70">
              A EVA utiliza IA (Gemini 2.5 Flash) para interpretar mensagens em linguagem natural e extrair dados financeiros automaticamente.
              Também suporta análise de imagens de notas fiscais e cupons.
            </p>
          </Section>

          {/* Spacer */}
          <div className="h-20" />
        </div>
      </div>
    </div>
  );
}
