import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plug, Building2 } from "lucide-react";

const integrations = [
  {
    name: "Asaas",
    description: "Integração bancária com o Asaas para conciliação automática de cobranças, recebimentos e pagamentos.",
    status: "Em breve" as const,
  },
];

export default function Integracoes() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Integrações</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Conecte suas contas bancárias e serviços financeiros para automatizar sua gestão.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {integrations.map((integration) => (
          <Card key={integration.name} className="relative overflow-hidden opacity-80">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
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

        {/* Placeholder for future integrations */}
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
