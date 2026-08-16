import {
  BarChart3,
  Wallet,
  Calculator,
  CreditCard,
  Building2,
  FileText,
  Users,
  TrendingUp,
} from "lucide-react";

const features = [
  {
    icon: BarChart3,
    title: "Dashboard inteligente",
    description: "Visão completa das suas finanças em tempo real. Receitas, despesas, saldo e projeções num único painel.",
  },
  {
    icon: Wallet,
    title: "Multi-contas",
    description: "Gerencie contas bancárias, carteiras, cartões de crédito e maquininhas em um só lugar.",
  },
  {
    icon: Calculator,
    title: "Precificação FHC",
    description: "Calcule o preço ideal dos seus serviços com a metodologia de Formação de Hora Clínica.",
  },
  {
    icon: CreditCard,
    title: "Controle de maquininhas",
    description: "Taxas MDR, antecipação, liquidação D+2/D+30. Saiba exatamente quanto entra na sua conta.",
  },
  {
    icon: Building2,
    title: "Pessoal + Empresarial",
    description: "Alterne entre finanças pessoais e de múltiplas empresas sem sair da plataforma.",
  },
  {
    icon: FileText,
    title: "DRE automático",
    description: "Demonstrativo de Resultados gerado automaticamente a partir dos seus lançamentos.",
  },
  {
    icon: Users,
    title: "Contatos e fornecedores",
    description: "Cadastro completo de clientes e fornecedores vinculados aos seus lançamentos.",
  },
  {
    icon: TrendingUp,
    title: "Fluxo de caixa",
    description: "Projeção de fluxo de caixa futuro para tomar decisões financeiras com segurança.",
  },
];

export function LandingFeatures() {
  return (
    <section id="features" className="py-20 sm:py-24 bg-[hsl(var(--landing-surface))]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-14">
          <p className="text-sm font-semibold text-[hsl(var(--landing-accent))] mb-3 tracking-wider uppercase">
            Funcionalidades
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
            Tudo que você precisa para organizar o dinheiro
          </h2>
          <p className="text-[hsl(var(--landing-muted))] max-w-2xl mx-auto text-lg">
            Ferramentas pensadas para quem quer controle total das finanças sem complexidade
            desnecessária.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f, i) => (
            <div
              key={i}
              className="group p-6 rounded-2xl border border-[hsl(var(--landing-border))] bg-[hsl(var(--landing-card))] transition-all duration-300 hover:shadow-[0_18px_40px_-24px_hsl(var(--landing-accent)/0.5)] hover:-translate-y-0.5"
            >
              <div className="h-10 w-10 rounded-xl flex items-center justify-center mb-4 bg-[hsl(var(--landing-accent-soft)/0.18)]">
                <f.icon className="h-5 w-5 text-[hsl(var(--landing-accent))]" />
              </div>
              <h3 className="font-display font-semibold text-base mb-2">{f.title}</h3>
              <p className="text-sm text-[hsl(var(--landing-muted))] leading-relaxed">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
