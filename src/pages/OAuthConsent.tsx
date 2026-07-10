import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck } from "lucide-react";

// Typed wrapper around supabase.auth.oauth (beta namespace not in types yet).
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};
const oauth = (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Faltando authorization_id na URL.");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?next=" + encodeURIComponent(next);
        return;
      }
      if (!oauth?.getAuthorizationDetails) {
        setError("OAuth authorization server não está habilitado neste projeto Supabase.");
        return;
      }
      const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        setError(error.message ?? String(error));
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      setError(error.message ?? String(error));
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("O servidor de autorização não retornou uma URL de redirecionamento.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-md shadow-premium border-border/50">
        <CardHeader className="text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="font-display">Conectar ao EVA OS</CardTitle>
          <CardDescription>
            Autorize um aplicativo externo a acessar sua conta EVA OS.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {error && (
            <div className="rounded-md bg-destructive/10 text-destructive p-3">{error}</div>
          )}
          {!error && !details && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando autorização…
            </div>
          )}
          {details && (
            <>
              <p>
                <strong>{details.client?.name ?? "Um aplicativo"}</strong> quer se conectar à sua
                conta EVA OS e agir em seu nome.
              </p>
              <p className="text-muted-foreground text-xs">
                Somente permita se você iniciou esta conexão. As ferramentas expostas incluem leitura
                e criação de lançamentos, contas e categorias — sempre respeitando seus dados (RLS).
              </p>
            </>
          )}
        </CardContent>
        {details && !error && (
          <CardFooter className="flex gap-2">
            <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decide(false)}>
              Recusar
            </Button>
            <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Autorizar
            </Button>
          </CardFooter>
        )}
      </Card>
    </main>
  );
}
