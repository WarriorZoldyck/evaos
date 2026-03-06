import { RotateCcw, Wallet, Coins } from "lucide-react";

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
          className="relative w-[280px] h-[320px] cursor-pointer transition-transform duration-700"
          style={{
            transformStyle: "preserve-3d",
            transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
          onClick={(e) => { e.stopPropagation(); onFlip(); }}
        >
          {/* FRONT - Wallet closed */}
          <div
            className="absolute inset-0 rounded-3xl flex flex-col overflow-hidden"
            style={{
              backfaceVisibility: "hidden",
              background: "linear-gradient(160deg, #8B5E3C 0%, #6B3F1F 30%, #5A3318 60%, #4A2810 100%)",
              boxShadow: "0 20px 50px -10px rgba(74,40,16,0.5), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -2px 4px rgba(0,0,0,0.2)",
            }}
          >
            {/* Leather texture overlay */}
            <div className="absolute inset-0 opacity-[0.06]" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='6' height='6' viewBox='0 0 6 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M3 0L6 3L3 6L0 3z'/%3E%3C/g%3E%3C/svg%3E")`,
            }} />

            {/* Stitching line top */}
            <div className="mx-5 mt-4 border-t border-dashed" style={{ borderColor: "rgba(255,220,180,0.2)" }} />

            {/* Wallet flap / clasp area */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 relative">
              {/* Wallet icon embossed */}
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                style={{
                  background: "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
                  boxShadow: "inset 0 1px 2px rgba(255,255,255,0.05), 0 2px 8px rgba(0,0,0,0.2)",
                }}
              >
                <Wallet className="h-8 w-8" style={{ color: "rgba(255,220,180,0.5)" }} />
              </div>

              <p className="text-xs uppercase tracking-[0.3em] font-medium mb-6" style={{ color: "rgba(255,220,180,0.4)" }}>
                Carteira
              </p>

              {/* Metal clasp */}
              <div className="w-12 h-5 rounded-full flex items-center justify-center"
                style={{
                  background: "linear-gradient(180deg, #C9A96E 0%, #A07D4A 50%, #8A6B3D 100%)",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3)",
                }}
              >
                <div className="w-6 h-1 rounded-full" style={{ background: "rgba(0,0,0,0.15)" }} />
              </div>
            </div>

            {/* Bottom section with name */}
            <div className="px-6 pb-5">
              {/* Stitching */}
              <div className="mb-3 border-t border-dashed" style={{ borderColor: "rgba(255,220,180,0.15)" }} />
              
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(255,220,180,0.3)" }}>
                    Nome
                  </p>
                  <p className="text-sm font-medium truncate max-w-[160px]" style={{ color: "rgba(255,220,180,0.7)" }}>
                    {walletName || "Minha Carteira"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(255,220,180,0.3)" }}>
                    Saldo
                  </p>
                  <p className="text-base font-bold font-mono" style={{ color: "rgba(255,220,180,0.85)" }}>
                    {formatCurrency(balance)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* BACK - Wallet open */}
          <div
            className="absolute inset-0 rounded-3xl flex flex-col overflow-hidden"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              background: "linear-gradient(160deg, #7A5232 0%, #5E3A1E 40%, #4A2810 100%)",
              boxShadow: "0 20px 50px -10px rgba(74,40,16,0.5), inset 0 1px 0 rgba(255,255,255,0.08)",
            }}
          >
            {/* Texture */}
            <div className="absolute inset-0 opacity-[0.06]" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='6' height='6' viewBox='0 0 6 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M3 0L6 3L3 6L0 3z'/%3E%3C/g%3E%3C/svg%3E")`,
            }} />

            {/* Inner lining */}
            <div className="mx-4 mt-4 mb-2 flex-1 rounded-2xl p-4 flex flex-col justify-between"
              style={{
                background: "linear-gradient(135deg, rgba(139,94,60,0.3) 0%, rgba(74,40,16,0.4) 100%)",
                border: "1px solid rgba(255,220,180,0.08)",
              }}
            >
              {/* Card slots visual */}
              <div className="space-y-2">
                <div className="text-[9px] uppercase tracking-widest mb-2" style={{ color: "rgba(255,220,180,0.35)" }}>
                  Detalhes
                </div>
                
                <div className="flex items-center gap-3 py-2 px-3 rounded-lg" style={{ background: "rgba(0,0,0,0.15)" }}>
                  <Coins className="h-4 w-4 flex-shrink-0" style={{ color: "rgba(255,220,180,0.4)" }} />
                  <div>
                    <p className="text-[9px] uppercase tracking-wider" style={{ color: "rgba(255,220,180,0.35)" }}>Saldo Inicial</p>
                    <p className="text-sm font-mono" style={{ color: "rgba(255,220,180,0.8)" }}>{formatCurrency(balance)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 py-2 px-3 rounded-lg" style={{ background: "rgba(0,0,0,0.15)" }}>
                  <Wallet className="h-4 w-4 flex-shrink-0" style={{ color: "rgba(255,220,180,0.4)" }} />
                  <div>
                    <p className="text-[9px] uppercase tracking-wider" style={{ color: "rgba(255,220,180,0.35)" }}>Nome</p>
                    <p className="text-sm font-mono" style={{ color: "rgba(255,220,180,0.8)" }}>{walletName || "—"}</p>
                  </div>
                </div>
              </div>

              {/* Brand */}
              <div className="flex items-center justify-between pt-3 mt-auto" style={{ borderTop: "1px solid rgba(255,220,180,0.08)" }}>
                <span className="text-[8px] uppercase tracking-widest" style={{ color: "rgba(255,220,180,0.2)" }}>
                  EVA OS · Carteira Digital
                </span>
                <Wallet className="h-3 w-3" style={{ color: "rgba(255,220,180,0.15)" }} />
              </div>
            </div>

            {/* Stitching bottom */}
            <div className="mx-5 mb-4 border-t border-dashed" style={{ borderColor: "rgba(255,220,180,0.12)" }} />
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
          {isFlipped ? "Ver frente" : "Ver detalhes"}
        </button>
      </div>
    </>
  );
}
