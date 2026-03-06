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
    title: "Plano de caixa",
    description: "Projeção de fluxo de caixa futuro para tomar decisões financeiras com segurança.",
  },
];

export function LandingFeatures() {
  return (
    <section id="features" className="py-24 relative">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[hsl(215,25%,16%)] to-transparent" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <p className="text-sm font-medium text-[hsl(195,100%,50%)] mb-3 tracking-wider uppercase">Funcionalidades</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
            Tudo que você precisa.{" "}
            <span className="text-[hsl(215,18%,55%)]">Nada que não precisa.</span>
          </h2>
          <p className="text-[hsl(215,18%,55%)] max-w-2xl mx-auto text-lg">
            Ferramentas pensadas para quem quer controle total das finanças sem complexidade desnecessária.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f, i) => (
            <div
              key={i}
              className="group p-6 rounded-2xl border border-[hsl(215,25%,12%)] hover:border-[hsl(195,100%,50%/0.3)] transition-all duration-300"
              style={{ background: "hsla(220,30%,7%,0.6)" }}
            >
              <div className="h-10 w-10 rounded-xl flex items-center justify-center mb-4 bg-[hsl(195,100%,50%/0.1)] group-hover:bg-[hsl(195,100%,50%/0.15)] transition-colors">
                <f.icon className="h-5 w-5 text-[hsl(195,100%,50%)]" />
              </div>
              <h3 className="font-display font-semibold text-base mb-2">{f.title}</h3>
              <p className="text-sm text-[hsl(215,18%,55%)] leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
