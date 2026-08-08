import { useEffect, useRef, useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  AssistantService,
  ChatMessage,
  GoalPlanningContext,
} from "@/services/assistant/AssistantService";
import type { AssistantReply } from "@/services/assistant/AssistantService";

interface GoalChatProps {
  /** O chat conhece apenas a interface — nunca a implementação. */
  service: AssistantService;
  buildContext: (history: ChatMessage[]) => GoalPlanningContext;
  onReply: (reply: AssistantReply) => void;
  suggestions?: string[];
  disabled?: boolean;
}

const uid = () => Math.random().toString(36).slice(2, 10);

export function GoalChat({
  service,
  buildContext,
  onReply,
  suggestions = [],
  disabled,
}: GoalChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || thinking || disabled) return;

    const userMsg: ChatMessage = {
      id: uid(),
      role: "user",
      text: trimmed,
      createdAt: Date.now(),
    };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setThinking(true);
    try {
      const reply = await service.sendMessage(buildContext(history));
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "assistant", text: reply.text, createdAt: Date.now() },
      ]);
      onReply(reply);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: uid(),
          role: "assistant",
          text: "Não consegui responder agora. Tente novamente em instantes.",
          createdAt: Date.now(),
        },
      ]);
    } finally {
      setThinking(false);
    }
  };

  return (
    <div className="glass-card flex flex-col overflow-hidden">
      <div className="px-5 pt-4 pb-2">
        <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
          Conversa com a EVA
        </p>
      </div>

      <div ref={listRef} className="flex-1 min-h-[220px] max-h-[340px] overflow-y-auto px-5 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground py-6">
            Me diga em quanto tempo quer atingir a meta ou quanto consegue guardar por mês —
            eu comparo com os seus números reais.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "flex animate-in fade-in slide-in-from-bottom-1 duration-200",
              m.role === "user" ? "justify-end" : "justify-start",
            )}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm",
                m.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : "text-foreground",
              )}
            >
              <p className="whitespace-pre-wrap">{m.text}</p>
              <p
                className={cn(
                  "mt-1 text-[10px]",
                  m.role === "user" ? "text-primary-foreground/70" : "text-muted-foreground",
                )}
              >
                {new Date(m.createdAt).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin text-primary" />
            EVA está pensando…
          </div>
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-5 pt-3">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s)}
              disabled={thinking || disabled}
              className="rounded-full border border-border/60 bg-background/40 px-3 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="p-3 pt-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            disabled={disabled}
            placeholder="Ex.: consigo guardar R$ 800 por mês"
            className="flex-1 resize-none rounded-xl border border-border/40 bg-muted/40 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 max-h-24 overflow-y-auto"
          />
          <Button
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => send(input)}
            disabled={thinking || disabled || !input.trim()}
            aria-label="Enviar mensagem"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
