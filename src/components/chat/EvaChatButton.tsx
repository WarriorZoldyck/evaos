import { useState } from "react";
import { Bot } from "lucide-react";
import { EvaChatPanel } from "./EvaChatPanel";

export function EvaChatButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <EvaChatPanel open={open} onClose={() => setOpen(false)} />
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-4 right-4 z-50 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 flex items-center justify-center group"
          aria-label="Abrir assistente EVA"
        >
          <Bot className="h-5 w-5 group-hover:scale-110 transition-transform" />
        </button>
      )}
    </>
  );
}
