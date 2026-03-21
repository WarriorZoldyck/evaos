import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plug, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import logoAsaas from "@/assets/logo-asaas.png";
import logoBradesco from "@/assets/logo-bradesco.png";
import logoItau from "@/assets/logo-itau.png";
import logoSantander from "@/assets/logo-santander.png";
import logoC6Bank from "@/assets/logo-c6bank.png";

const staticIntegrations = [
  {
    name: "Asaas",
    description: "Integração bancária com o Asaas para conciliação automática de cobranças, recebimentos e pagamentos.",
    status: "Em breve" as const,
    logo: logoAsaas,
    bgClass: "bg-[#2532c4]",
  },
  {
    name: "Bradesco",
    description: "Conexão com o Bradesco para importação automática de extratos e conciliação bancária.",
    status: "Em breve" as const,
    logo: logoBradesco,
    bgClass: "bg-white",
  },
  {
    name: "Itaú",
    description: "Conexão com o Itaú Unibanco para importação automática de extratos e conciliação bancária.",
    status: "Em breve" as const,
    logo: logoItau,
    bgClass: "bg-white",
  },
  {
    name: "Santander",
    description: "Conexão com o Santander para importação automática de extratos e conciliação bancária.",
    status: "Em breve" as const,
    logo: logoSantander,
    bgClass: "bg-white",
  },
  {
    name: "C6 Bank",
    description: "Conexão com o C6 Bank para importação automática de extratos e conciliação bancária.",
    status: "Em breve" as const,
    logo: logoC6Bank,
    bgClass: "bg-white",
  },
];

export default function Integracoes() {
  const { user } = useAuth();
  const [whatsappActive, setWhatsappActive] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("whatsapp_number")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        setWhatsappActive(!!data?.whatsapp_number);
      });
  }, [user]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Integrações</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Conecte suas contas bancárias e serviços financeiros para automatizar sua gestão.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* WhatsApp Integration */}
        <Card className={`relative overflow-hidden ${whatsappActive ? "" : "opacity-80"}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <MessageCircle className="h-5 w-5 text-green-500" />
                </div>
                <CardTitle className="text-base">WhatsApp</CardTitle>
              </div>
              <Badge
                variant={whatsappActive ? "default" : "secondary"}
                className={
                  whatsappActive
                    ? "bg-green-500/15 text-green-500 border-0 text-xs"
                    : "bg-primary/10 text-primary border-0 text-xs"
                }
              >
                {whatsappActive ? "Ativo" : "Inativo"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Envie lançamentos e consulte seus dados financeiros pelo WhatsApp com a EVA.
            </p>
            {!whatsappActive && (
              <p className="text-xs text-muted-foreground mt-2">
                Cadastre seu número em <strong>Configurações</strong> para ativar.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Bank / service integrations */}
        {staticIntegrations.map((integration) => (
          <Card key={integration.name} className="relative overflow-hidden opacity-80">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-lg ${integration.bgClass} flex items-center justify-center overflow-hidden`}>
                    <img
                      src={integration.logo}
                      alt={integration.name}
                      className="h-8 w-8 object-contain"
                    />
                  </div>
                  <CardTitle className="text-base">{integration.name}</CardTitle>
                </div>
                <Badge variant="secondary" className="bg-primary/10 text-primary border-0 text-xs">
                  {integration.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{integration.description}</p>
            </CardContent>
          </Card>
        ))}

        {/* Placeholder */}
        <Card className="border-dashed opacity-50 flex items-center justify-center min-h-[140px]">
          <CardContent className="flex flex-col items-center gap-2 py-6 text-center">
            <Plug className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Mais integrações em breve</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
