import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Notice {
  id: string;
  title: string;
  body: string;
}

export function SystemNoticeDialog() {
  const { user } = useAuth();
  const [notices, setNotices] = useState<Notice[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from("system_notices")
          .select("id, title, body")
          .eq("user_id", user.id)
          .is("seen_at", null)
          .order("created_at", { ascending: true });
        if (!cancelled && data) setNotices(data as Notice[]);
      } catch {
        /* silencioso */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const current = notices[0];
  if (!current) return null;

  const dismiss = async () => {
    setNotices((n) => n.slice(1));
    try {
      await (supabase as any)
        .from("system_notices")
        .update({ seen_at: new Date().toISOString() })
        .eq("id", current.id);
    } catch {
      /* silencioso */
    }
  };

  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{current.title}</AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-line">{current.body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={dismiss}>Entendi</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
