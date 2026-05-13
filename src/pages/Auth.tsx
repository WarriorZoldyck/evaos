import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, BarChart3, Wallet, Shield, Zap, Users } from "lucide-react";
import evaLogo from "@/assets/eva-os-logo.jpeg";

export default function Auth() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-[#0B1120]">
      {/* Ambient background — aurora orbs + grid */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,hsl(var(--primary)/0.18),transparent_55%),radial-gradient(ellipse_at_bottom_right,hsl(var(--primary)/0.12),transparent_60%)]" />
        <div className="absolute top-[-10%] left-[10%] h-[480px] w-[480px] rounded-full bg-primary/15 blur-[120px] animate-pulse" style={{ animationDuration: "6s" }} />
        <div className="absolute bottom-[-15%] right-[5%] h-[520px] w-[520px] rounded-full bg-primary/10 blur-[140px] animate-pulse" style={{ animationDuration: "8s" }} />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(ellipse at center, black 40%, transparent 75%)",
          }}
        />
      </div>

      {/* Left side - Premium Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center p-12 relative z-10">
        <div className="relative max-w-md text-center space-y-10 animate-fade-in">
          {/* Logo */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl bg-gradient-primary opacity-40 blur-2xl" />
              <div className="relative h-20 w-20 rounded-2xl overflow-hidden ring-1 ring-primary/30 glow-primary shadow-premium">
                <img src={evaLogo} alt="EVA OS" className="h-full w-full object-cover" />
              </div>
            </div>
            <div>
              <h1 className="text-5xl font-bold font-display tracking-tight text-gradient-primary">EVA OS</h1>
              <p className="text-xs uppercase tracking-[0.3em] text-primary/70 mt-2">Gestão Financeira Inteligente</p>
            </div>
          </div>

          <p className="text-lg text-foreground/80 leading-relaxed">
            Controle total das suas finanças pessoais e empresariais em um único lugar.
          </p>

          <div className="grid grid-cols-2 gap-3 pt-4">
            <FeatureCard icon={BarChart3} title="Relatórios" description="DRE e Fluxo de Caixa em tempo real" />
            <FeatureCard icon={Wallet} title="Multi-conta" description="Bancos, cartões e carteiras" />
            <FeatureCard icon={Shield} title="Seguro" description="Dados criptografados e protegidos" />
            <FeatureCard icon={Zap} title="Inteligente" description="Automações e cálculos MDR" />
          </div>
        </div>
      </div>

      {/* Right side - Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 relative z-10">
        <div className="w-full max-w-md relative animate-fade-in">
          {/* Mobile logo */}
          <div className="lg:hidden flex flex-col items-center gap-3 mb-8">
            <div className="relative">
              <div className="absolute inset-0 rounded-xl bg-gradient-primary opacity-40 blur-xl" />
              <div className="relative h-16 w-16 rounded-xl overflow-hidden ring-1 ring-primary/30 glow-primary shadow-premium">
                <img src={evaLogo} alt="EVA OS" className="h-full w-full object-cover" />
              </div>
            </div>
            <h1 className="text-3xl font-bold font-display text-gradient-primary">EVA OS</h1>
          </div>

          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6 bg-card/40 backdrop-blur-xl border border-border/40 p-1 h-11">
              <TabsTrigger value="login" className="data-[state=active]:bg-gradient-primary-soft data-[state=active]:text-primary data-[state=active]:shadow-[0_0_12px_hsl(var(--primary)/0.3)] data-[state=active]:border data-[state=active]:border-primary/30">Entrar</TabsTrigger>
              <TabsTrigger value="signup" className="data-[state=active]:bg-gradient-primary-soft data-[state=active]:text-primary data-[state=active]:shadow-[0_0_12px_hsl(var(--primary)/0.3)] data-[state=active]:border data-[state=active]:border-primary/30">Cadastrar</TabsTrigger>
              <TabsTrigger value="hub" className="data-[state=active]:bg-gradient-primary-soft data-[state=active]:text-primary data-[state=active]:shadow-[0_0_12px_hsl(var(--primary)/0.3)] data-[state=active]:border data-[state=active]:border-primary/30">EVA Hub</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <LoginForm />
            </TabsContent>

            <TabsContent value="signup">
              <SignupForm />
            </TabsContent>

            <TabsContent value="hub">
              <HubLoginForm />
            </TabsContent>
          </Tabs>

          <p className="text-center text-[11px] text-muted-foreground/70 mt-6 tracking-wide">
            Protegido por criptografia de ponta a ponta · EVA OS © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="rounded-xl border border-border/40 bg-card/40 backdrop-blur-xl p-4 text-left card-hover group hover:border-primary/30 hover:shadow-[0_8px_24px_-12px_hsl(var(--primary)/0.4)] transition-all duration-300">
      <div className="h-9 w-9 rounded-lg bg-gradient-primary-soft border border-primary/20 flex items-center justify-center mb-2.5 group-hover:glow-primary-sm transition-all duration-300">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <h3 className="font-semibold text-sm text-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
    </div>
  );
}

function LoginForm() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  if (showForgot) {
    return <ForgotPasswordForm onBack={() => setShowForgot(false)} />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        toast.error("Erro ao entrar", { description: error.message });
      }
    } catch (err) {
      console.error("Login error:", err);
      toast.error("Erro inesperado ao entrar.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-premium border border-border/40 bg-card/60 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="text-xl font-display">Bem-vindo de volta</CardTitle>
        <CardDescription>Entre com suas credenciais para acessar o EVA OS</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="login-email">Email</Label>
            <Input
              id="login-email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="login-password">Senha</Label>
            <Input
              id="login-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-11"
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full h-11 bg-gradient-primary hover:opacity-90 transition-opacity font-semibold" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Entrar
          </Button>
          <button
            type="button"
            onClick={() => setShowForgot(true)}
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            Esqueci minha senha
          </button>
        </CardFooter>
      </form>
    </Card>
  );
}

function SignupForm() {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Senha muito curta", { description: "A senha deve ter pelo menos 6 caracteres." });
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await signUp(email, password, fullName);
      if (error) {
        toast.error("Erro ao cadastrar", { description: error.message });
      } else {
        toast.success("Conta criada!", { description: "Verifique seu email para confirmar o cadastro." });
      }
    } catch (err) {
      console.error("Signup error:", err);
      toast.error("Erro inesperado ao cadastrar.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-premium border border-border/40 bg-card/60 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="text-xl font-display">Criar conta</CardTitle>
        <CardDescription>Preencha seus dados para começar a usar o EVA OS</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="signup-name">Nome completo</Label>
            <Input
              id="signup-name"
              placeholder="Seu nome"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-email">Email</Label>
            <Input
              id="signup-email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="signup-password">Senha</Label>
            <Input
              id="signup-password"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="h-11"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full h-11 bg-gradient-primary hover:opacity-90 transition-opacity font-semibold" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar conta
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error } = await resetPassword(email);
      if (error) {
        toast.error("Erro", { description: error.message });
      } else {
        toast.success("Email enviado!", { description: "Verifique sua caixa de entrada para redefinir a senha." });
        onBack();
      }
    } catch (err) {
      console.error("Reset password error:", err);
      toast.error("Erro inesperado ao redefinir senha.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-premium border border-border/40 bg-card/60 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="text-xl font-display">Esqueci minha senha</CardTitle>
        <CardDescription>Informe seu email para receber o link de redefinição</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="forgot-email">Email</Label>
            <Input
              id="forgot-email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-11"
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full h-11 bg-gradient-primary hover:opacity-90 transition-opacity font-semibold" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar link
          </Button>
          <button
            type="button"
            onClick={onBack}
            className="text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            Voltar ao login
          </button>
        </CardFooter>
      </form>
    </Card>
  );
}

function HubLoginForm() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        toast.error("Erro ao entrar", { description: error.message });
      } else {
        navigate("/eva-hub", { replace: true });
      }
    } catch (err) {
      console.error("Hub login error:", err);
      toast.error("Erro inesperado ao entrar.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-premium border border-primary/30 bg-gradient-to-br from-card/70 to-primary/10 backdrop-blur-xl">
      <CardHeader>
        <div className="flex items-center gap-2 mb-1">
          <Users className="h-5 w-5 text-primary" />
          <CardTitle className="text-xl font-display">Acesse seu Hub</CardTitle>
        </div>
        <CardDescription>Área exclusiva para membros convidados e gestores de equipe</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hub-email">Email</Label>
            <Input
              id="hub-email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hub-password">Senha</Label>
            <Input
              id="hub-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-11"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full h-11 bg-gradient-primary hover:opacity-90 transition-opacity font-semibold" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Entrar no Hub
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
