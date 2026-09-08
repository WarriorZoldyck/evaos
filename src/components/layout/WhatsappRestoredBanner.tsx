import { useState } from "react";
import { X, MessageCircle, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

const STORAGE_KEY = "eva.announcement.whatsapp-restored.seen.v1";

/**
 * Banner global one-time: avisa que a EVA no WhatsApp voltou a funcionar.
 * Some após o usuário dispensar (persistido em localStorage).
 */
export function WhatsappRestoredBanner() {
  const [show, setShow] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== "1";
    } catch {
      return false;
    }
  });

  if (!show) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
    setShow(false);
  };

  return (
    <div className="relative mx-4 md:mx-6 mt-4 rounded-lg border border-green-500/40 bg-gradient-to-r from-green-500/10 via-green-500/5 to-transparent p-4 pr-10 animate-fade-in">
      <button
        onClick={dismiss}
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Fechar aviso"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-green-500/15 p-2 shrink-0">
          <MessageCircle className="h-4 w-4 text-green-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground flex items-center gap-2">
            A EVA no WhatsApp voltou a funcionar 🎉
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Já é possível enviar lançamentos, fotos, PDFs e áudios para a EVA pelo WhatsApp novamente.
            As respostas estão mais rápidas e estáveis agora.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Link
              to="/integracoes"
              onClick={dismiss}
              className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md border border-green-500/40 bg-green-500/10 text-green-500 hover:bg-green-500/20 text-xs font-medium transition-colors"
            >
              <Sparkles className="h-3 w-3" /> Configurar WhatsApp
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
