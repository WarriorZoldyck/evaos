import { Link, RotateCcw, ChevronLeft, ChevronRight, Receipt } from "lucide-react";

interface CreditCard3DProps {
  isFlipped: boolean;
  onFlip: () => void;
  cardName: string;
  cardDigits: string;
  cardClosing: string;
  cardDue: string;
  cardLimit: string;
  bankAccountName?: string;
  usedAmount?: number;
  parentCardName?: string;
  // Cycle navigation (optional — used on Dashboard)
  cycleLabel?: string;
  onPrevCycle?: () => void;
  onNextCycle?: () => void;
  canPrev?: boolean;
  canNext?: boolean;
  onOpenBill?: () => void;
}

export function CreditCard3D({
  isFlipped,
  onFlip,
  cardName,
  cardDigits,
  cardClosing,
  cardDue,
  cardLimit,
  bankAccountName,
  usedAmount = 0,
  parentCardName,
  cycleLabel,
  onPrevCycle,
  onNextCycle,
  canPrev,
  canNext,
  onOpenBill,
}: CreditCard3DProps) {
  const formatDisplayNumber = () => {
    const d = cardDigits.padEnd(4, "•");
    return `•••• •••• •••• ${d}`;
  };

  const formatCurrency = (val: number | string) => {
    const num = typeof val === "string" ? Number(val) || 0 : val;
    return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const limit = Number(cardLimit) || 0;
  const available = limit - usedAmount;
  const usagePercent = limit > 0 ? Math.min((usedAmount / limit) * 100, 100) : 0;

  const showCycleControls = !!cycleLabel && (!!onPrevCycle || !!onNextCycle);

  return (
    <>
      <div className="flex justify-center" style={{ perspective: "1000px" }}>
        <div
          className="relative w-[340px] h-[210px] cursor-pointer transition-transform duration-700"
          style={{
            transformStyle: "preserve-3d",
            transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
          onClick={(e) => { e.stopPropagation(); onFlip(); }}
        >
          {/* FRONT */}
          <div
            className="absolute inset-0 rounded-2xl p-6 flex flex-col justify-between overflow-hidden"
            style={{
              backfaceVisibility: "hidden",
              background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)",
              boxShadow: "0 20px 60px -15px rgba(0,0,0,0.5), 0 0 40px -10px rgba(15,52,96,0.3)",
            }}
          >
            <div
              className="absolute top-0 right-0 w-40 h-40 opacity-10 rounded-full"
              style={{
                background: "radial-gradient(circle, white 0%, transparent 70%)",
                transform: "translate(30%, -30%)",
              }}
            />

            <div className="flex items-start justify-between relative z-10">
              <div
                className="w-11 h-8 rounded-md"
                style={{
                  background: "linear-gradient(135deg, #d4a574 0%, #f0d48a 30%, #c9a050 60%, #d4a574 100%)",
                  boxShadow: "inset 0 1px 2px rgba(255,255,255,0.3), inset 0 -1px 2px rgba(0,0,0,0.2)",
                }}
              >
                <div className="w-full h-full grid grid-cols-3 grid-rows-2 gap-px p-1 opacity-40">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="rounded-[1px] bg-amber-800/40" />
                  ))}
                </div>
              </div>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white/50">
                <path d="M12 6c3.3 0 6 2.7 6 6s-2.7 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M12 10c1.1 0 2 .9 2 2s-.9 2-2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M12 2c5.5 0 10 4.5 10 10s-4.5 10-10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>

            <p
              className="text-lg tracking-[0.2em] font-mono relative z-10"
              style={{ color: "rgba(255,255,255,0.85)" }}
            >
              {formatDisplayNumber()}
            </p>

            <div className="flex items-end justify-between relative z-10">
              <div className="flex flex-col">
                <p
                  className="text-sm uppercase tracking-wider truncate max-w-[200px]"
                  style={{ color: "rgba(255,255,255,0.7)" }}
                >
                  {cardName || "SEU NOME AQUI"}
                </p>
                {parentCardName && (
                  <span className="flex items-center gap-1 text-[9px] mt-0.5" style={{ color: "rgba(147,197,253,0.8)" }}>
                    <Link className="h-2.5 w-2.5" />
                    Virtual • {parentCardName}
                  </span>
                )}
              </div>
              <div className="flex -space-x-2">
                <div className="w-7 h-7 rounded-full bg-red-500/80" />
                <div className="w-7 h-7 rounded-full bg-yellow-500/60" />
              </div>
            </div>
          </div>

          {/* BACK */}
          <div
            className="absolute inset-0 rounded-2xl flex flex-col overflow-hidden"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)",
              boxShadow: "0 20px 60px -15px rgba(0,0,0,0.5), 0 0 40px -10px rgba(15,52,96,0.3)",
            }}
          >
            <div className="w-full h-8 mt-4 bg-black/70" />

            <div className="flex-1 px-5 py-2 flex flex-col justify-between">
              {/* Usage bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>
                    Utilizado
                  </span>
                  <span className="text-[9px] font-mono" style={{ color: "rgba(255,255,255,0.5)" }}>
                    {usagePercent.toFixed(0)}%
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${usagePercent}%`,
                      background: usagePercent > 80
                        ? "linear-gradient(90deg, #ef4444, #dc2626)"
                        : usagePercent > 50
                        ? "linear-gradient(90deg, #f59e0b, #d97706)"
                        : "linear-gradient(90deg, #22c55e, #16a34a)",
                    }}
                  />
                </div>
                <div className="flex justify-between">
                  <span className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.7)" }}>
                    {formatCurrency(usedAmount)}
                  </span>
                  <span className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.4)" }}>
                    de {formatCurrency(limit)}
                  </span>
                </div>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-3 gap-x-3 mt-1">
                <div>
                  <span className="text-[8px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>
                    Disponível
                  </span>
                  <p className="text-xs font-mono font-semibold" style={{ color: available >= 0 ? "rgba(134,239,172,0.9)" : "rgba(252,165,165,0.9)" }}>
                    {formatCurrency(available)}
                  </p>
                </div>
                <div>
                  <span className="text-[8px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>
                    Fecha
                  </span>
                  <p className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.85)" }}>
                    Dia {cardClosing || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-[8px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>
                    Vence
                  </span>
                  <p className="text-xs font-mono" style={{ color: "rgba(255,255,255,0.85)" }}>
                    Dia {cardDue || "—"}
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between mt-1">
                <span className="text-[8px] uppercase tracking-wider truncate max-w-[180px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                  {bankAccountName || "Conta vinculada"}
                </span>
                <div className="flex -space-x-2">
                  <div className="w-4 h-4 rounded-full bg-red-500/60" />
                  <div className="w-4 h-4 rounded-full bg-yellow-500/40" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cycle navigator + open bill (only when props provided) */}
      {showCycleControls && (
        <div className="mt-2 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); if (canPrev !== false) onPrevCycle?.(); }}
            disabled={canPrev === false}
            className="h-6 w-6 rounded-md border border-border/60 flex items-center justify-center hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Fatura anterior"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="text-[11px] font-medium text-muted-foreground min-w-[140px] text-center tabular-nums">
            {cycleLabel}
          </span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); if (canNext !== false) onNextCycle?.(); }}
            disabled={canNext === false}
            className="h-6 w-6 rounded-md border border-border/60 flex items-center justify-center hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Próxima fatura"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="mt-1 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onFlip(); }}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCcw className="h-3 w-3" />
          {isFlipped ? "Ver frente" : "Ver verso"}
        </button>
        {onOpenBill && (
          <>
            <span className="text-muted-foreground/40">•</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onOpenBill(); }}
              className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
            >
              <Receipt className="h-3 w-3" />
              Ver / Pagar fatura
            </button>
          </>
        )}
      </div>
    </>
  );
}
