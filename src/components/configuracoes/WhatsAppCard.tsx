import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageCircle, Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function WhatsAppCard() {
  const { user } = useAuth();
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("whatsapp_number")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.whatsapp_number) setWhatsappNumber(data.whatsapp_number);
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
        .update({ whatsapp_number: cleaned || null })
        .eq("id", user.id);
      if (error) throw error;
      setWhatsappNumber(cleaned);
      toast.success("Número de WhatsApp salvo!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar número");
    } finally {
      setSaving(false);
    }
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
      <CardContent className="space-y-3">
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
            <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
