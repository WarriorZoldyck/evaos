import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { MessageCircle, Save, Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function WhatsAppCard() {
  const { user } = useAuth();
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [remindersDays, setRemindersDays] = useState<number[]>([1, 3]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("whatsapp_number, whatsapp_reminders_enabled, whatsapp_reminders_days")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.whatsapp_number) setWhatsappNumber(data.whatsapp_number);
        if (data?.whatsapp_reminders_enabled) setRemindersEnabled(data.whatsapp_reminders_enabled);
        if (data?.whatsapp_reminders_days) setRemindersDays(data.whatsapp_reminders_days);
        setLoading(false);
      });
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    const cleaned = whatsappNumber.replace(/\D/g, "");
    if (cleaned && (cleaned.length < 10 || cleaned.length > 13)) {
      toast.error("Número inválido. Use o formato: 5511999999999");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ 
          whatsapp_number: cleaned || null,
          whatsapp_reminders_enabled: remindersEnabled,
          whatsapp_reminders_days: remindersDays,
        })
        .eq("id", user.id);
      if (error) throw error;
      setWhatsappNumber(cleaned);
      toast.success("Configurações de WhatsApp salvas!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  const handleTestReminder = async () => {
    if (!user) return;
    if (!whatsappNumber) {
      toast.error("Salve um número de WhatsApp primeiro para testar.");
      return;
    }
    setTesting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Não autenticado");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-whatsapp-reminder`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Erro ao enviar teste");
      
      toast.success("Mensagens enviadas com sucesso!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar mensagens");
    } finally {
      setTesting(false);
    }
  };

  const toggleDay = (day: number) => {
    setRemindersDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort((a,b) => a - b)
    );
  };

  const formatDisplay = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `+${digits.slice(0, 2)} (${digits.slice(2)}`;
    if (digits.length <= 9) return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4)}`;
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9, 13)}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          WhatsApp
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Cadastre seu número para enviar lançamentos e consultar dados pelo WhatsApp via EVA.
          </p>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : (
            <div className="flex items-end gap-3">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Número com DDI + DDD</Label>
                <Input
                  value={formatDisplay(whatsappNumber)}
                  onChange={(e) => setWhatsappNumber(e.target.value.replace(/\D/g, ""))}
                  placeholder="+55 (11) 99999-9999"
                  maxLength={22}
                />
              </div>
            </div>
          )}
        </div>

        {!loading && (
          <div className="space-y-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Lembretes de Vencimento</Label>
                <p className="text-xs text-muted-foreground">
                  Receba avisos no WhatsApp antes de suas contas vencerem.
                </p>
              </div>
              <Switch
                checked={remindersEnabled}
                onCheckedChange={setRemindersEnabled}
              />
            </div>
            
            {remindersEnabled && (
              <div className="space-y-3 pl-4 border-l-2 border-primary/20">
                <Label className="text-xs font-medium text-muted-foreground">Avisar com antecedência de:</Label>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="day-3" checked={remindersDays.includes(3)} onCheckedChange={() => toggleDay(3)} />
                    <label htmlFor="day-3" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      3 dias antes
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="day-1" checked={remindersDays.includes(1)} onCheckedChange={() => toggleDay(1)} />
                    <label htmlFor="day-1" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      1 dia antes
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="day-0" checked={remindersDays.includes(0)} onCheckedChange={() => toggleDay(0)} />
                    <label htmlFor="day-0" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      No dia do vencimento
                    </label>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex items-center justify-between pt-2">
              <Button onClick={handleTestReminder} disabled={testing || !whatsappNumber} variant="outline" size="sm" className="gap-2">
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Enviar agora
              </Button>

              <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar Tudo
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
