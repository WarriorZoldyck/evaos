import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface FormFieldSettings {
  supplier_client: boolean;
  contact_name: boolean;
  subcategories: boolean;
  payment_method: boolean;
  account_fields: boolean;
  installments: boolean;
  recurring: boolean;
  notes: boolean;
  barcode: boolean;
  attachment_url: boolean;
}

const DEFAULT_SETTINGS: FormFieldSettings = {
  supplier_client: true,
  contact_name: false,
  subcategories: true,
  payment_method: true,
  account_fields: true,
  installments: true,
  recurring: true,
  notes: true,
  barcode: false,
  attachment_url: false,
};

export function useFormFieldSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<FormFieldSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("transaction_form_fields")
        .eq("id", user.id)
        .single();

      if (data?.transaction_form_fields) {
        setSettings({ ...DEFAULT_SETTINGS, ...(data.transaction_form_fields as Partial<FormFieldSettings>) });
      }
      setLoading(false);
    })();
  }, [user]);

  const updateField = useCallback(
    async (field: keyof FormFieldSettings, value: boolean) => {
      if (!user) return;
      const updated = { ...settings, [field]: value };
      setSettings(updated);

      await supabase
        .from("profiles")
        .update({ transaction_form_fields: updated as any })
        .eq("id", user.id);
    },
    [user, settings]
  );

  return { settings, loading, updateField };
}
