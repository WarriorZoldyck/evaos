import { RotateCcw, Wallet } from "lucide-react";

interface VirtualWalletCardProps {
  isFlipped: boolean;
  onFlip: () => void;
  walletName: string;
  balance: string;
}

export function VirtualWalletCard({ isFlipped, onFlip, walletName, balance }: VirtualWalletCardProps) {
  const formatCurrency = (val: string) => {
    const num = Number(val) || 0;
    return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

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
              background: "linear-gradient(135deg, hsl(195 60% 20%) 0%, hsl(195 80% 30%) 50%, hsl(200 70% 25%) 100%)",
              boxShadow: "0 20px 60px -15px rgba(0,0,0,0.4), 0 0 30px -10px hsl(195 100% 50% / 0.2)",
            }}
          >
            {/* Decorative circles */}
            <div className="absolute top-0 right-0 w-32 h-32 opacity-10 rounded-full"
              style={{ background: "radial-gradient(circle, white 0%, transparent 70%)", transform: "translate(20%, -30%)" }}
            />
            <div className="absolute bottom-0 left-0 w-24 h-24 opacity-5 rounded-full"
              style={{ background: "radial-gradient(circle, white 0%, transparent 70%)", transform: "translate(-20%, 30%)" }}
            />

            <div className="flex items-start justify-between relative z-10">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-sm">
                  <Wallet className="h-5 w-5" style={{ color: "rgba(255,255,255,0.8)" }} />
                </div>
                <span className="text-xs uppercase tracking-widest font-medium" style={{ color: "rgba(255,255,255,0.5)" }}>
                  Carteira Virtual
                </span>
              </div>
              <div className="flex gap-1">
                {[0,1,2].map(i => (
                  <div key={i} className="w-2 h-2 rounded-full" style={{ background: `rgba(255,255,255,${0.15 + i * 0.1})` }} />
                ))}
              </div>
            </div>

            <div className="relative z-10">
              <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "rgba(255,255,255,0.4)" }}>
                Saldo
              </p>
              <p className="text-2xl font-bold font-mono tracking-wider" style={{ color: "rgba(255,255,255,0.9)" }}>
                {formatCurrency(balance)}
              </p>
            </div>

            <div className="flex items-end justify-between relative z-10">
              <p className="text-sm uppercase tracking-wider truncate max-w-[220px]"
                style={{ color: "rgba(255,255,255,0.6)" }}
              >
                {walletName || "MINHA CARTEIRA"}
              </p>
              <div className="w-8 h-5 rounded-sm bg-white/10 flex items-center justify-center">
                <div className="w-4 h-3 rounded-[2px] border border-white/20" />
              </div>
            </div>
          </div>

          {/* BACK */}
          <div
            className="absolute inset-0 rounded-2xl flex flex-col overflow-hidden"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              background: "linear-gradient(135deg, hsl(195 60% 20%) 0%, hsl(195 80% 30%) 50%, hsl(200 70% 25%) 100%)",
              boxShadow: "0 20px 60px -15px rgba(0,0,0,0.4), 0 0 30px -10px hsl(195 100% 50% / 0.2)",
            }}
          >
            <div className="w-full h-10 mt-5 bg-black/40" />
            <div className="flex-1 px-5 py-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div>
                  <span className="text-[9px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>
                    Nome
                  </span>
                  <p className="text-sm font-mono" style={{ color: "rgba(255,255,255,0.85)" }}>
                    {walletName || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-[9px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.4)" }}>
                    Saldo Inicial
                  </span>
                  <p className="text-sm font-mono" style={{ color: "rgba(255,255,255,0.85)" }}>
                    {formatCurrency(balance)}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[9px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.3)" }}>
                  EVA OS · Carteira Digital
                </span>
                <Wallet className="h-4 w-4" style={{ color: "rgba(255,255,255,0.2)" }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onFlip(); }}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <RotateCcw className="h-3 w-3" />
          {isFlipped ? "Ver frente" : "Ver verso"}
        </button>
      </div>
    </>
  );
}
