import { useEffect, useRef, useState, useCallback } from "react";
import {
  LayoutDashboard, ArrowLeftRight, BarChart3, FileText, Calculator,
  CreditCard, FolderTree, Users, Settings, BookOpen, Lightbulb,
  Building2, User, MessageSquare, Code, Send, AlertTriangle,
  CheckCircle2, Repeat, Wallet, ChevronDown, Copy, Check, Terminal,
  Sparkles, Landmark, Network, Filter, Search,
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
      { id: "whats-new", title: "Novidades", icon: Sparkles },
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
      { id: "filters", title: "Filtros & Busca", icon: Filter },
      { id: "credit-card-bill", title: "Fatura de Cartão", icon: CreditCard },
      { id: "account-statement", title: "Extrato da Conta", icon: Landmark },
    ],
  },
  {
    label: "Relatórios",
    items: [
      { id: "dashboard", title: "Dashboard", icon: LayoutDashboard },
      { id: "cashflow", title: "Fluxo de Caixa", icon: BarChart3 },
      { id: "dre", title: "DRE", icon: FileText },
    ],
  },
  {
    label: "Inteligência",
    items: [
      { id: "analises-eva", title: "Análises EVA", icon: Sparkles },
      { id: "eva-hub", title: "EVA Hub", icon: Network },
    ],
  },
  {
    label: "Ferramentas",
    items: [
      { id: "pricing", title: "Precificação", icon: Calculator },
      { id: "integrations", title: "Integrações Bancárias", icon: Landmark },
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

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-display text-foreground flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          Documentação
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Aprenda como utilizar todas as funcionalidades do EVA OS. Última revisão: julho/2026.
        </p>
      </div>

      {isMobile && <MobileNav />}

      <div className="flex gap-8">
        {!isMobile && (
          <aside className="w-56 shrink-0 sticky top-0 self-start">
            <ScrollArea className="h-[calc(100vh-10rem)]">
              <SidebarNav />
            </ScrollArea>
          </aside>
        )}

        <div ref={scrollContainerRef} className="flex-1 min-w-0 max-w-3xl overflow-y-auto h-[calc(100vh-10rem)] pr-2">
          {/* ---- Visão Geral ---- */}
          <Section id="overview" title="Visão Geral do EVA OS" icon={Lightbulb}>
            <p>
              O <strong className="text-foreground">EVA OS</strong> é um sistema completo de gestão financeira para pessoas físicas e empresas.
              Controla receitas, despesas, contas bancárias, cartões de crédito, carteiras, maquininhas, fornecedores e clientes — com integração nativa
              ao WhatsApp via IA (EVA) e conexão automática com bancos.
            </p>
            <p>Principais recursos:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Dashboard interativo</strong> — cards clicáveis (Entradas, Saídas, Previstas, Saldo Atual, Faturamento) com drill-down e detalhamento por categoria</li>
              <li><strong className="text-foreground">Lançamentos</strong> — CRUD completo com parcelamento, recorrências, transferências internas e importação de extrato</li>
              <li><strong className="text-foreground">Análises EVA</strong> — staging para lançamentos criados via IA, com aprovação individual/lote</li>
              <li><strong className="text-foreground">Fluxo de Caixa</strong> — fluxo de caixa mensal com projeção</li>
              <li><strong className="text-foreground">DRE</strong> — Demonstrativo de Resultado por competência</li>
              <li><strong className="text-foreground">Precificação</strong> — cálculo de preço sugerido por procedimento com custos fixos e margem</li>
              <li><strong className="text-foreground">Integrações bancárias</strong> — Pluggy (Open Finance), Itaú, Asaas</li>
              <li><strong className="text-foreground">WhatsApp (EVA)</strong> — assistente com IA para criar/consultar lançamentos por texto, áudio, foto ou PDF</li>
              <li><strong className="text-foreground">EVA Hub</strong> — workspaces multi-usuário com papéis e auditoria</li>
            </ul>
          </Section>

          {/* ---- Contextos ---- */}
          <Section id="contexts" title="Contextos: Pessoal vs Empresas" icon={Building2}>
            <p>O EVA OS separa suas finanças pessoais das finanças de cada empresa cadastrada. Todos os dados (contas, categorias, lançamentos, relatórios) são filtrados pelo contexto ativo.</p>
            <p>Use o <strong className="text-foreground">seletor de contexto</strong> na barra lateral para alternar entre:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><User className="inline h-3.5 w-3.5 mr-1" /><strong className="text-foreground">Pessoal</strong> — finanças individuais, sem CNPJ vinculado</li>
              <li><Building2 className="inline h-3.5 w-3.5 mr-1" /><strong className="text-foreground">Empresa</strong> — finanças por CNPJ. Cadastre empresas em Configurações</li>
            </ul>
            <p className="text-xs text-muted-foreground/70 mt-2">
              Transferências internas entre contas do mesmo contexto (ex.: Pró-labore de Empresa → Pessoal) são detectadas automaticamente e <strong className="text-foreground">excluídas do faturamento e do DRE</strong> para evitar duplicidade.
            </p>
          </Section>

          {/* ---- Novidades ---- */}
          <Section id="whats-new" title="Novidades Recentes" icon={Sparkles} badge="Atualizado">
            <p>Últimos ajustes lançados neste ciclo:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Dashboard drill-down</strong> — todos os cards de resumo (Entradas, Saídas, Entradas/Saídas Previstas, Saldo Atual) e os cards do grid de categorias abrem modal detalhado com filtros, exportação CSV e a coluna Conta.</li>
              <li><strong className="text-foreground">Saldo Atual por conta</strong> — clique no card "Saldo Atual" para ver saldo de cada conta/carteira; clique numa conta para ir ao extrato dela no mês selecionado.</li>
              <li><strong className="text-foreground">Calendário no extrato</strong> — popover com seleção de mês/ano além das setas de navegação.</li>
              <li><strong className="text-foreground">Cabeçalho fixo</strong> — filtros de período e busca do Dashboard e de Lançamentos ficam ancorados no header global durante a rolagem.</li>
              <li><strong className="text-foreground">Filtro unificado</strong> em Lançamentos — dropdown "Filtrar por" com drilldown Categoria → Fornecedor → Cliente.</li>
              <li><strong className="text-foreground">EVA reconhece boletos pagos</strong> — quando você marca um boleto como pago pelo WhatsApp, EVA sugere baixar o pendente equivalente com botões 1/2/3 (Sim/Não/Editar) e envia um card visual.</li>
              <li><strong className="text-foreground">Ações rápidas no WhatsApp</strong> — todo novo lançamento vem com 1 ✅ Aprovar / 2 ❌ Cancelar / 3 ✏️ Editar direto na primeira resposta.</li>
              <li><strong className="text-foreground">PIX/Transferência</strong> só aceitam Conta Bancária; <strong className="text-foreground">Carteira</strong> apenas em Dinheiro (com auto-seleção da primeira carteira).</li>
              <li><strong className="text-foreground">Status inteligente</strong> — Dinheiro, PIX, Transferência e Débito Automático já vêm como "Pago" por padrão.</li>
            </ul>
          </Section>

          {/* ---- Contas ---- */}
          <Section id="accounts" title="Contas, Carteiras e Cartões" icon={CreditCard} badge="Cadastro">
            <p>Em <strong className="text-foreground">Contas & Cartões</strong> você gerencia:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-foreground">Contas Bancárias</strong> — Corrente ou Poupança, com saldo inicial. A coluna <strong className="text-foreground">Saldo Atual</strong> soma saldo inicial + todas as movimentações Pagas.</li>
              <li><strong className="text-foreground">Carteiras (Wallets)</strong> — Dinheiro em espécie. Renderizadas em 3D estilo "carteira de couro".</li>
              <li><strong className="text-foreground">Cartões de Crédito</strong> — Vinculados a uma conta. Defina dia de fechamento/vencimento para cálculo automático do ciclo. Cartões pai/filho (adicional) são agrupados.</li>
              <li><strong className="text-foreground">Maquininhas</strong> — Terminais com taxa de débito/crédito, MDR e prazo de recebimento (D+X).</li>
            </ul>
            <p className="text-xs text-muted-foreground/70">Contas excluídas ficam em soft-delete por 30 dias antes da purga definitiva.</p>
          </Section>

          {/* ---- Categorias ---- */}
          <Section id="categories" title="Categorias e Subcategorias" icon={FolderTree} badge="Cadastro">
            <p>Categorias hierárquicas de até <strong className="text-foreground">3 níveis</strong> (categoria → subcategoria → sub-subcategoria), com drag & drop para reordenar.</p>
            <p>Cada categoria pode ser:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Receita</strong> — só aparece em lançamentos de receita</li>
              <li><strong className="text-foreground">Despesa</strong> — só em despesas</li>
              <li><strong className="text-foreground">Ambos</strong> — disponível nos dois tipos</li>
            </ul>
            <p className="mt-2">
              Categorias são mapeadas para <strong className="text-foreground">Centros de Custos</strong> (usados no DRE) e alimentam os gráficos de rosca e o grid de detalhamento do Dashboard.
              Usuários novos recebem um conjunto padrão automaticamente via trigger.
            </p>
          </Section>

          {/* ---- Contatos ---- */}
          <Section id="contacts" title="Fornecedores e Clientes" icon={Users} badge="Cadastro">
            <p>
              Cadastre fornecedores e clientes com nome, CPF/CNPJ, e-mail e telefone. Podem ser criados <strong className="text-foreground">inline</strong> direto no formulário de lançamento
              e são usados para filtrar, agrupar e gerar relatórios.
            </p>
          </Section>

          {/* ---- Lançamentos ---- */}
          <Section id="transactions" title="Lançamentos" icon={ArrowLeftRight} badge="Principal">
            <p>Tela central do sistema. Cada lançamento é uma <strong className="text-foreground">receita</strong> ou <strong className="text-foreground">despesa</strong> com:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Descrição, valor, data de pagamento e competência (podem divergir)</li>
              <li>Categoria com até 3 níveis</li>
              <li>Conta bancária, carteira, cartão de crédito ou maquininha</li>
              <li>Fornecedor ou cliente</li>
              <li>Anexo (comprovante em PDF/imagem)</li>
              <li>Status <Badge variant="secondary" className="text-[10px]">Pendente</Badge> ou <Badge className="text-[10px]">Pago</Badge></li>
            </ul>
            <div className="p-3 rounded-lg border bg-primary/5 mt-2 text-xs">
              <p className="font-medium text-foreground mb-1">Regras de forma de pagamento</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li><strong className="text-foreground">Dinheiro</strong> → apenas Carteira (primeira auto-selecionada; obrigatório)</li>
                <li><strong className="text-foreground">PIX / Transferência</strong> → apenas Conta Bancária</li>
                <li><strong className="text-foreground">Débito automático</strong> → status vem como Pago por padrão</li>
                <li>Formas acima já criam o lançamento como <strong className="text-foreground">Pago</strong>; boleto/crédito vêm como Pendente</li>
              </ul>
            </div>
            <Separator className="my-3" />
            <p className="font-medium text-foreground flex items-center gap-1"><Repeat className="h-3.5 w-3.5" /> Parcelamentos</p>
            <p>
              Defina número de parcelas, taxa de juros (Sistema Francês — Price), intervalo customizável em dias e opcionalmente uma <strong className="text-foreground">entrada</strong>.
              A tabela de preview é <strong className="text-foreground">editável</strong> parcela a parcela, e o resíduo do arredondamento vai para a última parcela.
              A competência permanece fixa; a data de pagamento incrementa por parcela.
            </p>
            <Separator className="my-3" />
            <p className="font-medium text-foreground">Recorrências</p>
            <p>Recorrências mensais/semanais/anuais são materializadas virtualmente para os próximos 90 dias. Cada ocorrência pode ser editada individualmente ou em série.</p>
            <Separator className="my-3" />
            <p className="font-medium text-foreground flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Liquidação inteligente</p>
            <p>Ao liquidar, informe o valor efetivamente pago. Se divergir, o sistema oferece:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Descartar</strong> a diferença</li>
              <li><strong className="text-foreground">Criar pendente</strong> com o saldo restante</li>
              <li><strong className="text-foreground">Aplicar juros/multa</strong> sobre o saldo</li>
              <li><strong className="text-foreground">Redistribuir</strong> entre as parcelas restantes (séries)</li>
            </ul>
            <Separator className="my-3" />
            <p className="font-medium text-foreground">Transferências internas</p>
            <p>Crie um par receita/despesa vinculado por <code className="font-mono bg-muted px-1 rounded text-xs">transfer_id</code>. Quando origem e destino pertencem ao mesmo contexto, são <strong className="text-foreground">excluídas do faturamento e do DRE</strong> automaticamente (via trigger de banco).</p>
          </Section>

          {/* ---- Filtros ---- */}
          <Section id="filters" title="Filtros & Busca" icon={Filter}>
            <p>A tela de Lançamentos concentra o poder de filtragem em um cabeçalho fixo no topo, dividido em três camadas:</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li><strong className="text-foreground">Header global (fixo):</strong> período (Tudo/Hoje/Semana/Mês/Ano + setas de navegação), input de busca <Search className="inline h-3 w-3" />, botões Exportar, Importar Extrato e Novo Lançamento.</li>
              <li><strong className="text-foreground">Barra de filtros (fixa):</strong> toggles Tudo/Entradas/Saídas, Todos/Conciliados/Sem conciliação, filtro <strong className="text-foreground">Recentes</strong>, filtro unificado <strong className="text-foreground">Filtrar por</strong> (drilldown Categoria → Fornecedor → Cliente) e seletor de Contas.</li>
              <li><strong className="text-foreground">Tabs (fixas):</strong> Todos / Realizado / Projetado — decidem se recorrências virtuais e pendentes futuros aparecem.</li>
            </ol>
            <p className="text-xs text-muted-foreground/70">Todos os filtros são preservados na URL e restaurados ao voltar para a tela.</p>
          </Section>

          {/* ---- Fatura ---- */}
          <Section id="credit-card-bill" title="Pagamento de Fatura de Cartão" icon={CreditCard} badge="Fluxo">
            <p>O ciclo de fatura é calculado automaticamente com base no dia de fechamento e vencimento configurados no cartão.</p>
            <p><strong className="text-foreground">Fluxo:</strong></p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Filtre por cartão em Lançamentos, ou acesse pela tela de Contas</li>
              <li>Clique em <strong className="text-foreground">Pagar Fatura</strong> — o sistema já calcula o total do ciclo</li>
              <li>A fatura desconta <strong className="text-foreground">estornos</strong> (receitas no mesmo cartão) do total de despesas</li>
              <li>Informe o valor: integral, parcial ou excedente</li>
              <li>Para pagamento parcial, escolha o destino do saldo:
                <ul className="list-disc pl-5 mt-1 space-y-0.5">
                  <li>Rolar para próxima fatura (sem juros)</li>
                  <li>Rolar com juros (rotativo)</li>
                  <li>Criar lançamento avulso</li>
                </ul>
              </li>
              <li>Após pagar, o ciclo é <strong className="text-foreground">fechado</strong> — bloqueia edição das transações do período.</li>
            </ol>
          </Section>

          {/* ---- Extrato ---- */}
          <Section id="account-statement" title="Extrato da Conta" icon={Landmark}>
            <p>Cada conta bancária/carteira tem uma tela de extrato com <strong className="text-foreground">saldo progressivo</strong> linha a linha (do mais antigo ao mais recente).</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Navegação por mês via setas <strong className="text-foreground">ou</strong> calendário com dropdown de mês/ano</li>
              <li>Lançamentos pendentes ficam ocultos por padrão (só Pagos afetam saldo)</li>
              <li>Atalho para editar/excluir cada linha</li>
              <li>Abre já no mês selecionado no Dashboard quando acessado via clique no card "Saldo Atual"</li>
            </ul>
          </Section>

          {/* ---- Dashboard ---- */}
          <Section id="dashboard" title="Dashboard" icon={LayoutDashboard}>
            <p>Visão consolidada do período selecionado. Todos os elementos são clicáveis e abrem modais de detalhamento — sem sair da tela.</p>
            <p><strong className="text-foreground">Cards de resumo (5 colunas):</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Entradas</strong> → modal com todas as receitas Pagas do período (filtro por forma, exportação CSV, coluna Conta)</li>
              <li><strong className="text-foreground">Saídas</strong> → mesmo modelo para despesas Pagas</li>
              <li><strong className="text-foreground">Entradas Previstas</strong> → receitas Pendentes do período</li>
              <li><strong className="text-foreground">Saídas Previstas</strong> → despesas Pendentes do período</li>
              <li><strong className="text-foreground">Saldo Atual</strong> → soma dos saldos reais de todas as contas/carteiras + sparkline. Clique abre modal com saldo por conta; clique na conta leva ao extrato dela.</li>
            </ul>
            <p><strong className="text-foreground">Faturamento</strong> — card separado que soma receitas brutas (bruto do cartão via <code className="font-mono bg-muted px-1 rounded text-xs">original_amount</code>) excluindo transferências internas. Clique abre detalhamento por transação com MDR.</p>
            <p><strong className="text-foreground">Gráficos por categoria</strong> — dois donuts (receita e despesa) sem legenda interna. O grid à direita mostra o breakdown detalhado; cada card do grid é clicável e abre o mesmo modal filtrado pela categoria.</p>
            <p><strong className="text-foreground">Projeção de saldo</strong> — linha com evolução acumulada do caixa.</p>
            <p className="text-xs text-muted-foreground/70">O cabeçalho (título + seletor de conta + filtro de período) fica fixo no topo enquanto você rola.</p>
          </Section>

          {/* ---- Fluxo de Caixa ---- */}
          <Section id="cashflow" title="Fluxo de Caixa" icon={BarChart3}>
            <p>
              Fluxo de caixa por período agrupado por mês (ou semana), com entradas, saídas e saldo acumulado.
              Inclui projeção de recorrências e pendentes futuros nas colunas seguintes.
            </p>
          </Section>

          {/* ---- DRE ---- */}
          <Section id="dre" title="DRE — Demonstrativo de Resultado" icon={FileText}>
            <p>
              Relatório por <strong className="text-foreground">competência</strong> (não por data de pagamento), agrupando receitas e despesas por categoria/centro de custo.
              Duas visões disponíveis: <strong className="text-foreground">Gerencial</strong> (mais operacional) e <strong className="text-foreground">Contábil</strong> (formato tradicional com CMV, Deduções, Lucro Bruto/Líquido).
            </p>
            <p>Seções colapsáveis por categoria — clique para expandir subcategorias. Transferências internas são automaticamente excluídas.</p>
          </Section>

          {/* ---- Análises EVA ---- */}
          <Section id="analises-eva" title="Análises EVA" icon={Sparkles} badge="IA">
            <p>
              Toda vez que a EVA (WhatsApp ou chat in-app) cria um lançamento a partir de mensagem, foto, PDF ou áudio, ele é depositado em <strong className="text-foreground">Análises EVA</strong> como sugestão pendente, não direto em Lançamentos.
            </p>
            <p>Nessa tela você pode:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Aprovar</strong> individual ou em lote — vira lançamento real</li>
              <li><strong className="text-foreground">Editar</strong> antes de aprovar (categoria, conta, valor, contexto) — trocar o contexto recarrega as listas de contas/cartões corretas</li>
              <li><strong className="text-foreground">Rejeitar</strong> — descarta a sugestão</li>
              <li><strong className="text-foreground">Detectar baixa de pendente</strong> — quando EVA identifica que a mensagem é o pagamento de um boleto já cadastrado, o card exibe um selo "Possível baixa de pendente" com botão de reconciliação</li>
            </ul>
            <p className="text-xs text-muted-foreground/70">Duplicatas são detectadas via fingerprint SHA-256 (descrição + valor + data + fornecedor).</p>
          </Section>

          {/* ---- EVA Hub ---- */}
          <Section id="eva-hub" title="EVA Hub — Multi-usuário" icon={Network}>
            <p>Workspace compartilhado para contadores, sócios ou equipes gerenciarem múltiplos clientes/empresas.</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Membros</strong> — convites por e-mail com papéis Owner, Admin, Editor, Viewer</li>
              <li><strong className="text-foreground">Impersonation</strong> — o Owner pode atuar como qualquer membro para dar suporte</li>
              <li><strong className="text-foreground">Auditoria</strong> — log completo de ações (30 dias)</li>
              <li><strong className="text-foreground">Permissões granulares</strong> — por membro e por workspace</li>
              <li><strong className="text-foreground">WhatsApp de hub</strong> — cada membro registra seu número; mensagens são roteadas ao contexto certo</li>
            </ul>
          </Section>

          {/* ---- Precificação ---- */}
          <Section id="pricing" title="Precificação de Serviços" icon={Calculator}>
            <p>Calcule o preço ideal de cada procedimento/serviço com base em:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Custos fixos mensais (extraídos automaticamente das despesas)</li>
              <li>Horas trabalhadas/mês</li>
              <li>Tempo de execução do procedimento</li>
              <li>Materiais e insumos específicos (com importação em CSV)</li>
              <li>Margem de lucro desejada</li>
            </ul>
            <p className="mt-2">
              O sistema calcula <strong className="text-foreground">preço mínimo</strong> (break-even), <strong className="text-foreground">preço sugerido</strong> (com margem) e permite comparar procedimentos entre si.
            </p>
          </Section>

          {/* ---- Integrações bancárias ---- */}
          <Section id="integrations" title="Integrações Bancárias" icon={Landmark} badge="Automação">
            <p>Conecte suas contas para sincronizar extratos automaticamente:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-foreground">Pluggy (Open Finance)</strong> — conecta qualquer banco suportado via widget. Sincronização automática por webhook. Recomendado.</li>
              <li><strong className="text-foreground">Itaú</strong> — integração direta, usada quando o cliente já tem convênio.</li>
              <li><strong className="text-foreground">Asaas</strong> — para quem usa Asaas como conta digital/subadquirente. Requer API Key de produção.</li>
            </ul>
            <p className="text-xs text-muted-foreground/70">
              Ao conectar, você pode vincular a uma conta existente ou criar uma nova. Transações importadas passam pelo motor de <strong className="text-foreground">conciliação bancária</strong> —
              casamento automático com lançamentos já cadastrados (via valor + data + descrição) e fluxo manual para os restantes.
            </p>
          </Section>

          {/* ---- Configurações ---- */}
          <Section id="settings" title="Configurações" icon={Settings}>
            <p>Em Configurações você pode:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Gerenciar empresas (adicionar/editar CNPJ, razão social, logo)</li>
              <li>Personalizar campos visíveis no formulário de lançamento</li>
              <li>Alternar tema claro/escuro</li>
              <li>Editar perfil, senha e dados da assinatura</li>
              <li>Cadastrar/atualizar o número de WhatsApp para integração com a EVA</li>
              <li>Gerenciar integrações bancárias conectadas</li>
              <li>Excluir a conta (soft-delete de 30 dias)</li>
            </ul>
          </Section>

          {/* ================================================================ */}
          {/*  API WhatsApp (EVA)                                               */}
          {/* ================================================================ */}
          <Section id="whatsapp-api" title="API WhatsApp (EVA)" icon={MessageSquare} badge="API">
            <p>
              A <strong className="text-foreground">EVA</strong> é a assistente financeira do EVA OS no WhatsApp.
              Cria e consulta lançamentos por texto, áudio, foto de nota fiscal, PDF de boleto ou código de barras — em linguagem natural, em português.
            </p>
            <p>
              A comunicação é feita via <strong className="text-foreground">webhook</strong> (Edge Function do Supabase) integrado à <strong className="text-foreground">Evolution API</strong>.
              Cada usuário conecta seu número em Configurações → WhatsApp.
            </p>

            <Separator className="my-4" />

            <h3 className="text-base font-semibold text-foreground flex items-center gap-2 mb-2">
              <Code className="h-4 w-4" /> Endpoint
            </h3>
            <CodeBlock>{`POST https://<supabase-project>.supabase.co/functions/v1/whatsapp-webhook`}</CodeBlock>

            <h3 className="text-base font-semibold text-foreground flex items-center gap-2 mt-5 mb-2">
              <AlertTriangle className="h-4 w-4" /> Autenticação
            </h3>
            <p>Header <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">apikey</code> obrigatório (padrão Evolution API).</p>
            <CodeBlock title="Header obrigatório">{`apikey: <EVOLUTION_API_KEY>`}</CodeBlock>
            <p className="text-xs text-muted-foreground/70">
              Requisições sem esse header retornam <code className="font-mono">401 Unauthorized</code>.
            </p>

            <Separator className="my-4" />

            <h3 className="text-base font-semibold text-foreground flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4" /> Recursos suportados
            </h3>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">Texto</strong> — "Gastei 45 no mercado hoje"</li>
              <li><strong className="text-foreground">Áudio</strong> — transcrito automaticamente</li>
              <li><strong className="text-foreground">Imagem</strong> — foto de nota fiscal, cupom, comprovante PIX</li>
              <li><strong className="text-foreground">PDF</strong> — boletos e faturas</li>
              <li><strong className="text-foreground">Código de barras</strong> — linha digitável extraída automaticamente</li>
              <li><strong className="text-foreground">Parcelamentos</strong> — "12x de 150 no cartão"</li>
              <li><strong className="text-foreground">Detecção de contexto</strong> — menção ao nome/CNPJ da empresa alterna o contexto</li>
              <li><strong className="text-foreground">Memória de 30 dias</strong> — a EVA lembra do histórico recente com sumarização</li>
            </ul>

            <Separator className="my-4" />

            {/* Reconciliação de boleto */}
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-4 w-4" /> Reconciliação Automática de Boletos
            </h3>
            <p>
              Quando você marca um boleto como pago pelo WhatsApp e existe um <strong className="text-foreground">Pendente equivalente</strong> no sistema
              (mesmo fornecedor, valor próximo, data em ±10 dias), a EVA:
            </p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Cria o novo lançamento normalmente em Análises EVA</li>
              <li>Envia um <strong className="text-foreground">card visual (PNG)</strong> com o Pendente encontrado</li>
              <li>Oferece opções: <strong className="text-foreground">1</strong> Sim (dar baixa) / <strong className="text-foreground">2</strong> Não / <strong className="text-foreground">3</strong> Editar no app</li>
              <li>Ao confirmar, o Pendente é atualizado para "Pago" com a conta, forma e comprovante da mensagem</li>
            </ol>

            <Separator className="my-4" />

            {/* Ações rápidas */}
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4" /> Ações rápidas em cada novo lançamento
            </h3>
            <p>Todo lançamento novo criado via WhatsApp já vem acompanhado, na primeira mensagem de retorno, das ações:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong className="text-foreground">1 ✅ Aprovar</strong> — insere o lançamento em Transações</li>
              <li><strong className="text-foreground">2 ❌ Cancelar</strong> — descarta a sugestão</li>
              <li><strong className="text-foreground">3 ✏️ Editar no app</strong> — abre deep link para Análises EVA no card correto (já no contexto certo)</li>
            </ul>
            <p className="text-xs text-muted-foreground/70">Aparecem como lista clicável Evolution + fallback numerado (1/2/3) no corpo da mensagem.</p>

            <Separator className="my-4" />

            {/* Intenções */}
            <h3 className="text-base font-semibold text-foreground mb-2">Intenções suportadas</h3>
            <p>A IA classifica cada mensagem em uma de três intenções:</p>

            <div className="mt-4 p-4 rounded-lg border bg-card">
              <p className="font-semibold text-foreground flex items-center gap-2">
                <Badge className="text-[10px]">lancamento</Badge> Criar Lançamento
              </p>
              <p className="mt-1">
                Extrai descrição, valor, tipo (receita/despesa), categoria, subcategoria, forma de pagamento, conta e data.
                Vai para Análises EVA aguardando aprovação (via chat ou app).
              </p>
              <CodeBlock title="Exemplo">{`Gastei 45 reais no mercado hoje com PIX do Nubank`}</CodeBlock>
            </div>

            <div className="mt-4 p-4 rounded-lg border bg-card">
              <p className="font-semibold text-foreground flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px]">consulta</Badge> Consultar Dados
              </p>
              <p className="mt-1">Tipos de consulta:</p>
              <ul className="list-disc pl-5 space-y-1 mt-2">
                <li><code className="bg-muted px-1 rounded text-xs font-mono">saldo</code> — saldo consolidado de todas as contas e carteiras</li>
                <li><code className="bg-muted px-1 rounded text-xs font-mono">resumo_mes</code> — receitas, despesas, resultado e top categorias</li>
                <li><code className="bg-muted px-1 rounded text-xs font-mono">gastos_mes / receitas_mes</code> — totais do mês</li>
                <li><code className="bg-muted px-1 rounded text-xs font-mono">pendentes</code> — até 10 contas pendentes próximas</li>
                <li><code className="bg-muted px-1 rounded text-xs font-mono">gastos_categoria</code> — gastos filtrados por categoria</li>
                <li><code className="bg-muted px-1 rounded text-xs font-mono">listar_lancamentos</code> — busca histórica (até 365 dias) com filtros de fornecedor/categoria</li>
              </ul>
              <CodeBlock title="Exemplos">{`Qual meu saldo pessoal?
Quanto gastei com alimentação em janeiro?
Lista os últimos 5 pagamentos para "Sabesp"`}</CodeBlock>
            </div>

            <div className="mt-4 p-4 rounded-lg border bg-card">
              <p className="font-semibold text-foreground flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">conversa</Badge> Conversa Geral
              </p>
              <p className="mt-1">Mensagens fora de escopo recebem resposta conversacional (ex.: "oi", "obrigado").</p>
            </div>

            <Separator className="my-4" />

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
                    <td className="py-2">Header <code className="font-mono bg-muted px-1 rounded">apikey</code> ausente ou inválido</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4 font-mono font-semibold text-destructive">400</td>
                    <td className="py-2">Payload inválido (evento Evolution malformado)</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2 pr-4 font-mono font-semibold text-destructive">404</td>
                    <td className="py-2">Número não cadastrado em nenhum perfil ou membro do hub</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-mono font-semibold text-destructive">402</td>
                    <td className="py-2">Créditos do Lovable AI Gateway esgotados</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <Separator className="my-4" />

            <h3 className="text-base font-semibold text-foreground flex items-center gap-2 mb-2">
              <Settings className="h-4 w-4" /> Configuração
            </h3>
            <ol className="list-decimal pl-5 space-y-2">
              <li>
                <strong className="text-foreground">Cadastre seu número:</strong> Configurações → WhatsApp — no formato internacional
                (ex.: <code className="bg-muted px-1 rounded text-xs font-mono">5511999999999</code>). Membros do EVA Hub cadastram em HubMeuWhatsApp.
              </li>
              <li>
                <strong className="text-foreground">Aponte o webhook</strong> da sua instância Evolution para o endpoint acima.
              </li>
              <li>
                <strong className="text-foreground">Envie qualquer mensagem</strong> pelo WhatsApp — a EVA responderá em segundos.
              </li>
            </ol>
            <p className="mt-3 text-xs text-muted-foreground/70">
              A EVA usa o <strong className="text-foreground">Lovable AI Gateway</strong> (Gemini 2.5 Flash como default) para interpretar mensagens em linguagem natural
              e processar mídias (imagens, PDFs, áudios). Todo anexo é persistido no bucket privado <code className="font-mono bg-muted px-1 rounded">whatsapp-attachments</code>.
            </p>
          </Section>

          <div className="h-20" />
        </div>
      </div>
    </div>
  );
}
