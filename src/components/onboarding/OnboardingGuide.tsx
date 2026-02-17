import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Building2, CreditCard, FolderTree, ArrowLeftRight, LayoutDashboard,
  ChevronRight, Rocket, SkipForward, CheckCircle2, BookOpen,
} from "lucide-react";

const ONBOARDING_KEY = "eva-onboarding-completed";

interface Step {
  icon: React.ElementType;
  title: string;
  description: string;
  tip: string;
  route: string;
}

const steps: Step[] = [
  {
    icon: Building2,
    title: "1. Configure seu contexto",
    description:
      "Defina se vai usar o EVA OS para finanças pessoais ou de uma empresa. Você pode alternar entre contextos a qualquer momento pelo seletor na barra lateral.",
    tip: "Dica: Cadastre empresas em Configurações para separar suas finanças.",
    route: "/configuracoes",
  },
  {
    icon: CreditCard,
    title: "2. Cadastre suas contas",
    description:
      "Adicione suas contas bancárias, carteiras e cartões de crédito. Eles serão usados para vincular receitas e despesas.",
    tip: "Dica: Para cartões de crédito, informe o dia de fechamento e vencimento para cálculo automático da fatura.",
    route: "/contas",
  },
  {
    icon: FolderTree,
    title: "3. Organize suas categorias",
    description:
      "Crie categorias de receita e despesa para classificar seus lançamentos. Use subcategorias para mais detalhamento (até 3 níveis).",
    tip: "Dica: Categorias alimentam o DRE e os gráficos do Dashboard.",
    route: "/categorias",
  },
  {
    icon: ArrowLeftRight,
    title: "4. Crie seus lançamentos",
    description:
      "Registre receitas e despesas com valor, data, categoria e conta. Você pode parcelar, criar recorrências e vincular fornecedores ou clientes.",
    tip: "Dica: Personalize os campos visíveis do formulário em Configurações.",
    route: "/lancamentos",
  },
  {
    icon: LayoutDashboard,
    title: "5. Acompanhe no Dashboard",
    description:
      "O Dashboard mostra um resumo do período: receitas, despesas, resultado e projeção de saldo. Clique nos cards para ver os lançamentos detalhados.",
    tip: "Dica: Use o filtro de período para comparar meses diferentes.",
    route: "/",
  },
];

export function OnboardingGuide() {
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const completed = localStorage.getItem(ONBOARDING_KEY);
    if (!completed) {
      // Small delay to let the app render first
      const timer = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleSkip = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setOpen(false);
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  };

  const handleFinish = () => {
    localStorage.setItem(ONBOARDING_KEY, "true");
    setOpen(false);
  };

  const handleGoToStep = () => {
    const step = steps[currentStep];
    localStorage.setItem(ONBOARDING_KEY, "true");
    setOpen(false);
    navigate(step.route);
  };

  const step = steps[currentStep];
  const StepIcon = step.icon;
  const progress = ((currentStep + 1) / steps.length) * 100;
  const isLast = currentStep === steps.length - 1;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleSkip()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-primary" />
              Primeiros passos
            </DialogTitle>
            <span className="text-xs text-muted-foreground">
              {currentStep + 1} de {steps.length}
            </span>
          </div>
          <Progress value={progress} className="h-1.5 mt-2" />
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <StepIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-base">{step.title}</h3>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                {step.description}
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-primary/5 border border-primary/10 p-3">
            <p className="text-xs text-primary font-medium">{step.tip}</p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex gap-2 mr-auto">
            <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground gap-1">
              <SkipForward className="h-3.5 w-3.5" />
              Pular tutorial
            </Button>
          </div>
          <div className="flex gap-2">
            {currentStep > 0 && (
              <Button variant="outline" size="sm" onClick={handleBack}>
                Anterior
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleGoToStep} className="gap-1">
              Ir para esta etapa
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" onClick={handleNext} className="gap-1">
              {isLast ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Concluir
                </>
              ) : (
                <>
                  Próximo
                  <ChevronRight className="h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Reset onboarding to show it again */
export function resetOnboarding() {
  localStorage.removeItem(ONBOARDING_KEY);
}
