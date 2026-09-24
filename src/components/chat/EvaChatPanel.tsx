import { useState, useRef, useEffect } from "react";
import { X, Send, ImagePlus, Loader2, Bot, Settings, Key, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import ReactMarkdown from "react-markdown";
import { getStoredAiConfig, saveAiConfig, callDirectAi, detectProvider } from "@/services/aiService";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface EvaChatPanelProps {
  open: boolean;
  onClose: () => void;
}

export function EvaChatPanel({ open, onClose }: EvaChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<any>("auto");
  const [isSaved, setIsSaved] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { selectedCompanyId } = useCompany();
  const { canUseAI, refetch: refetchLimits } = usePlanLimits();

  useEffect(() => {
    const cfg = getStoredAiConfig();
    if (cfg.apiKey) {
      setApiKeyInput(cfg.apiKey);
      setSelectedProvider(cfg.provider || "auto");
    }
  }, []);

  useEffect(() => {
    if (open && inputRef.current && !showSettings) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, showSettings]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSaveConfig = () => {
    saveAiConfig({
      apiKey: apiKeyInput.trim(),
      provider: selectedProvider,
    });
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      setShowSettings(false);
    }, 1200);
  };

  const sendMessage = async (text: string, imageBase64?: string) => {
    if (!text.trim() && !imageBase64) return;

    const userContent: any = imageBase64
      ? [
          { type: "image_url", image_url: { url: imageBase64 } },
          { type: "text", text: text || "Analise esta imagem e extraia informações financeiras." },
        ]
      : text;

    const userMsg: Message = { role: "user", content: text || "[Imagem enviada]" };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    const aiConfig = getStoredAiConfig();

    try {
      // 1. Try default backend (Supabase Edge Function / Lovable)
      let backendSuccess = false;
      let replyText = "";

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/eva-chat`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
                apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              },
              body: JSON.stringify({
                messages: [
                  ...messages.map((m) => ({ role: m.role, content: m.content })),
                  { role: "user", content: userContent },
                ],
                companyId: selectedCompanyId,
              }),
            }
          );

          if (response.ok) {
            const data = await response.json();
            replyText = data.reply || "Sem resposta.";
            backendSuccess = true;
          }
        }
      } catch (e) {
        console.warn("Backend edge function unavailable or failed, falling back to direct AI:", e);
      }

      // 2. If backend failed (credits exhausted / maintenance / no key), use Direct AI Provider
      if (!backendSuccess) {
        if (!aiConfig.apiKey) {
          throw new Error(
            "Nenhuma chave de IA foi detectada no backend. Para conversar com a EVA, **clique no ícone de engrenagem ⚙️ acima** e insira sua chave da **Google Gemini**, **OpenAI**, **OpenRouter** ou **Groq**!"
          );
        }

        const systemPrompt = `Você é a EVA, assistente financeira inteligente do sistema EVA OS. Responda em português brasileiro de forma direta, amigável e profissional. Ajude o usuário com dúvidas sobre gestão financeira, relatórios, caixa e orçamentos.`;

        const formattedMessages = [
          { role: "system", content: systemPrompt },
          ...newMessages.map((m) => ({ role: m.role, content: m.content })),
        ];

        replyText = await callDirectAi(formattedMessages, aiConfig);
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: replyText },
      ]);
    } catch (err: any) {
      console.error("EVA chat error:", err);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `❌ ${err.message || "Erro ao se comunicar com a EVA."}` },
      ]);
    } finally {
      setIsLoading(false);
      refetchLimits();
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      sendMessage(input, base64);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  if (!open) return null;

  const currentConfig = getStoredAiConfig();
  const providerInfo = currentConfig.apiKey ? detectProvider(currentConfig.apiKey) : null;

  return (
    <div className="fixed bottom-20 right-4 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-6rem)] rounded-2xl border border-border/60 bg-background shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-primary/5 shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="font-semibold text-sm text-foreground">EVA</p>
              {providerInfo ? (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-medium border border-emerald-500/20">
                  {providerInfo.providerName}
                </span>
              ) : (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-medium border border-amber-500/20">
                  Sem créditos
                </span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">Assistente Financeira</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className={`h-7 w-7 ${showSettings ? "bg-primary/15 text-primary" : ""}`}
            onClick={() => setShowSettings(!showSettings)}
            title="Configurar Chave de IA"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Settings Screen */}
      {showSettings ? (
        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-muted/20">
          <div className="space-y-1">
            <h4 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
              <Key className="h-4 w-4 text-primary" />
              Configurar IA (Independente de Créditos)
            </h4>
            <p className="text-xs text-muted-foreground">
              Insira sua chave de API para a EVA responder usando a sua própria conta de IA (OpenAI, Gemini, OpenRouter ou Groq).
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">
                Chave da API (API Key)
              </label>
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="sk-..., AIza..., sk-or-..., gsk_..."
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Aceita chaves da <strong>OpenAI</strong>, <strong>Google Gemini</strong>, <strong>OpenRouter</strong> ou <strong>Groq</strong>.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setShowSettings(false)}
              >
                Voltar ao Chat
              </Button>
              <Button
                size="sm"
                className="text-xs gap-1.5"
                onClick={handleSaveConfig}
                disabled={isSaved}
              >
                {isSaved ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Salvo!
                  </>
                ) : (
                  "Salvar Chave"
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        /* Messages Screen */
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4 gap-3 text-muted-foreground">
                <Bot className="h-10 w-10 text-primary/40" />
                <p className="text-sm">
                  Olá! Sou a <strong className="text-foreground">EVA</strong>, sua assistente financeira.
                </p>
                <p className="text-xs">
                  Posso criar lançamentos, consultar saldos, gerenciar categorias e tirar dúvidas financeiras.
                </p>
                {!providerInfo && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5 text-xs text-amber-700 dark:text-amber-300 mt-2 text-left">
                    <p className="font-semibold flex items-center gap-1 mb-1">
                      💡 Dica de Configuração:
                    </p>
                    <p>
                      Para personalizar a IA ou usar sua própria chave diretamente, clique na engrenagem ⚙️ acima e adicione sua chave de API (Gemini, OpenAI ou OpenRouter)!
                    </p>
                  </div>
                )}
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted text-foreground rounded-bl-md"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-0.5 [&_ul]:my-1 [&_li]:my-0">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-md px-3 py-2 flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin text-primary" />
                  <span className="text-xs text-muted-foreground">EVA está pensando...</span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border/60 p-2 shrink-0">
            <div className="flex items-end gap-1.5">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
              >
                <ImagePlus className="h-4 w-4" />
              </Button>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua mensagem..."
                rows={1}
                className="flex-1 resize-none bg-muted/50 border border-border/40 rounded-xl px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 max-h-24 overflow-y-auto"
              />
              <Button
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => sendMessage(input)}
                disabled={isLoading || !input.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

