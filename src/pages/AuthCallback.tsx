import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Landing page for links sent by e-mail (confirmação de cadastro, magic link, convite).
 * Nunca deixa o usuário numa tela em branco: mostra estado, erro ou redireciona.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const run = async () => {
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const query = new URLSearchParams(window.location.search);

      const errDescription = hash.get("error_description") || query.get("error_description");
      const type = hash.get("type") || query.get("type");

      if (errDescription) {
        if (!active) return;
        setError(decodeURIComponent(errDescription));
        return;
      }

      if (type === "recovery") {
        navigate("/reset-password" + window.location.hash, { replace: true });
        return;
      }

      // Troca o código PKCE por sessão quando aplicável
      const code = query.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
        if (error && active) {
          setError(error.message);
          return;
        }
      }

      // Aguarda a sessão ser hidratada pelo detectSessionInUrl / storage
      for (let i = 0; i < 20; i++) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          if (!active) return;
          navigate("/dashboard", { replace: true });
          return;
        }
        await new Promise((r) => setTimeout(r, 150));
      }

      if (active) navigate("/auth", { replace: true });
    };

    run();
    return () => {
      active = false;
    };
  }, [navigate]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <div>
          <h1 className="text-lg font-semibold text-foreground">Não foi possível confirmar</h1>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">{error}</p>
        </div>
        <Button onClick={() => navigate("/auth", { replace: true })}>Ir para o login</Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <span className="text-sm text-muted-foreground">Confirmando sua conta...</span>
    </div>
  );
}
