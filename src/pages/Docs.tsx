import {
  LayoutDashboard, ArrowLeftRight, BarChart3, FileText, Calculator,
  CreditCard, FolderTree, Users, Settings, BookOpen, Lightbulb,
  ChevronDown, ChevronRight, Repeat, CheckCircle2, Wallet, Building2,
  User, Target, TrendingUp, HelpCircle,
} from "lucide-react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface DocSection {
  id: string;
  icon: React.ElementType;
  title: string;
  badge?: string;
  content: React.ReactNode;
}

function CollapsibleSection({ section }: { section: DocSection }) {
  const [open, setOpen] = useState(false);
  const Icon = section.icon;

  return (
    <Card
      className={cn(
        "transition-all duration-200 cursor-pointer",
        open ? "ring-1 ring-primary/30" : "hover:shadow-md"
      )}
    >
      <CardHeader
        className="py-4 px-5 cursor-pointer select-none"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{section.title}</CardTitle>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {section.badge && (
              <Badge variant="secondary" className="text-[10px]">
                {section.badge}
              </Badge>
            )}
            {open ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="pt-0 px-5 pb-5">
          <Separator className="mb-4" />
          <div className="text-sm text-muted-foreground space-y-3 leading-relaxed">
            {section.content}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

const sections: DocSection[] = [
  {
    id: "overview",
    icon: Lightbulb,
    title: "Visão Geral do EVA OS",
    content: (
      <>
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
        </ul>
      </>
    ),
  },
  {
    id: "contexts",
    icon: Building2,
    title: "Contextos: Pessoal vs Empresas",
    content: (
      <>
        <p>
          O EVA OS permite separar suas finanças pessoais das finanças de cada empresa cadastrada.
        </p>
        <p>
          Use o <strong className="text-foreground">seletor de contexto</strong> na barra lateral para alternar entre:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><User className="inline h-3.5 w-3.5 mr-1" /><strong className="text-foreground">Pessoal</strong> — finanças individuais, sem CNPJ vinculado</li>
          <li><Building2 className="inline h-3.5 w-3.5 mr-1" /><strong className="text-foreground">Empresa</strong> — finanças separadas por CNPJ. Cadastre empresas em Configurações</li>
        </ul>
        <p className="text-xs text-muted-foreground/70 mt-2">
          Todos os dados (contas, categorias, lançamentos) são filtrados pelo contexto ativo.
        </p>
      </>
    ),
  },
  {
    id: "accounts",
    icon: CreditCard,
    title: "Contas, Carteiras e Cartões",
    badge: "Cadastro",
    content: (
      <>
        <p>Em <strong className="text-foreground">Contas & Cartões</strong> você gerencia:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <strong className="text-foreground">Contas Bancárias</strong> — Corrente ou Poupança, com saldo inicial. É a conta de saída ao liquidar lançamentos.
          </li>
          <li>
            <strong className="text-foreground">Carteiras (Wallets)</strong> — Para controlar dinheiro em espécie ou contas informais.
          </li>
          <li>
            <strong className="text-foreground">Cartões de Crédito</strong> — Vinculados a uma conta bancária. Defina dia de fechamento e vencimento para cálculo automático do ciclo de fatura.
          </li>
          <li>
            <strong className="text-foreground">Maquininhas</strong> — Terminais de cartão com taxas de débito/crédito e prazo de recebimento.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "categories",
    icon: FolderTree,
    title: "Categorias e Subcategorias",
    badge: "Cadastro",
    content: (
      <>
        <p>
          Organize suas finanças com categorias hierárquicas de até <strong className="text-foreground">3 níveis</strong> (categoria → subcategoria → sub-subcategoria).
        </p>
        <p>Cada categoria pode ser do tipo:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">Receita</strong> — aparece apenas em lançamentos de receita</li>
          <li><strong className="text-foreground">Despesa</strong> — apenas em despesas</li>
          <li><strong className="text-foreground">Ambos</strong> — disponível em receitas e despesas</li>
        </ul>
        <p className="mt-2">
          As categorias alimentam o <strong className="text-foreground">DRE</strong> e os gráficos do <strong className="text-foreground">Dashboard</strong>.
        </p>
      </>
    ),
  },
  {
    id: "transactions",
    icon: ArrowLeftRight,
    title: "Lançamentos",
    badge: "Principal",
    content: (
      <>
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
          Ao parcelar, você pode definir o número de parcelas, taxa de juros, e opcionalmente um <strong className="text-foreground">valor de entrada</strong> diferente
          (1ª parcela maior, restante distribuído igualmente).
        </p>
        <Separator className="my-3" />
        <p className="font-medium text-foreground">Recorrências</p>
        <p>
          Crie lançamentos recorrentes (mensal, semanal, anual) que se repetem automaticamente. Cada ocorrência pode ser editada individualmente.
        </p>
        <Separator className="my-3" />
        <p className="font-medium text-foreground flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Liquidação</p>
        <p>
          Ao liquidar, informe o valor efetivamente pago. Se diferir do previsto, o sistema oferece opções:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">Descartar</strong> a diferença</li>
          <li><strong className="text-foreground">Criar pendente</strong> com o saldo restante</li>
          <li><strong className="text-foreground">Aplicar juros/multa</strong> sobre o saldo</li>
          <li><strong className="text-foreground">Redistribuir</strong> entre parcelas restantes (se for série)</li>
        </ul>
      </>
    ),
  },
  {
    id: "credit-card-bill",
    icon: CreditCard,
    title: "Pagamento de Fatura de Cartão",
    badge: "Fluxo",
    content: (
      <>
        <p>
          O sistema calcula automaticamente o <strong className="text-foreground">ciclo de fatura</strong> com base no dia de fechamento e vencimento do cartão.
        </p>
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
      </>
    ),
  },
  {
    id: "dashboard",
    icon: LayoutDashboard,
    title: "Dashboard",
    content: (
      <>
        <p>Visão consolidada do período selecionado:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">Cards de resumo</strong> — Receitas, Despesas, Resultado e Saldo</li>
          <li><strong className="text-foreground">Gráficos por categoria</strong> — Receita e despesa em pizza/barras</li>
          <li><strong className="text-foreground">Projeção de saldo</strong> — Gráfico de linha com saldo acumulado</li>
          <li><strong className="text-foreground">Próximos lançamentos</strong> — Transações pendentes mais próximas</li>
        </ul>
        <p className="mt-2">
          Clique em qualquer card ou fatia de gráfico para navegar direto aos lançamentos filtrados (drill-down).
        </p>
      </>
    ),
  },
  {
    id: "cashflow",
    icon: BarChart3,
    title: "Plano de Caixa",
    content: (
      <p>
        Relatório de fluxo de caixa por período. Mostra entradas e saídas agrupadas por mês/semana,
        com totais acumulados para visualizar a evolução do caixa ao longo do tempo.
      </p>
    ),
  },
  {
    id: "dre",
    icon: FileText,
    title: "DRE — Demonstrativo de Resultado",
    content: (
      <>
        <p>
          Relatório de resultado por <strong className="text-foreground">competência</strong> (não por data de pagamento).
          Agrupa receitas e despesas por categoria, mostrando o resultado líquido.
        </p>
        <p>
          As seções de Receitas e Despesas são <strong className="text-foreground">colapsáveis</strong>. Clique em uma categoria
          para expandir suas subcategorias.
        </p>
      </>
    ),
  },
  {
    id: "pricing",
    icon: Calculator,
    title: "Precificação de Serviços",
    content: (
      <>
        <p>
          Calcule o preço ideal de cada procedimento/serviço baseado em:
        </p>
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
      </>
    ),
  },
  {
    id: "contacts",
    icon: Users,
    title: "Fornecedores e Clientes",
    badge: "Cadastro",
    content: (
      <p>
        Cadastre fornecedores e clientes com nome e CPF/CNPJ. Eles podem ser vinculados a lançamentos
        para rastreabilidade. Útil para filtrar e gerar relatórios por contato.
      </p>
    ),
  },
  {
    id: "settings",
    icon: Settings,
    title: "Configurações",
    content: (
      <>
        <p>Em Configurações você pode:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Gerenciar empresas (adicionar/editar CNPJ)</li>
          <li>Personalizar campos visíveis no formulário de lançamento</li>
          <li>Alterar tema (claro/escuro)</li>
          <li>Gerenciar perfil e dados da conta</li>
        </ul>
      </>
    ),
  },
];

export default function Docs() {
  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          Documentação
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Aprenda como utilizar todas as funcionalidades do EVA OS.
        </p>
      </div>

      <div className="space-y-3">
        {sections.map((section) => (
          <CollapsibleSection key={section.id} section={section} />
        ))}
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-4 px-5">
          <div className="flex items-start gap-3">
            <HelpCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-foreground">Precisa de mais ajuda?</p>
              <p className="text-muted-foreground mt-1">
                Se tiver dúvidas sobre alguma funcionalidade, não hesite em perguntar. O EVA OS está em constante evolução!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
