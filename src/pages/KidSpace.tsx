import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";
import {
  fetchAllowanceRules,
  fetchKidGoals,
  getKidAvatar,
  computeBalances,
  syncAllowanceDeposits,
  evaluateBadges,
  getSeenBadges,
  markBadgesSeen,
  getUpcomingAllowances,
  KidGoal,
  KidBadge,
  AllowanceRule,
  Tx,
  EVA_GUIDE_IMAGE,
  formatBRL,
} from "@/lib/kids";
import { KidAvatar } from "@/components/kids/KidAvatar";
import { ChevronLeft, Rocket, Star, Telescope, Trophy, ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { endOfMonth, format, addMonths } from "date-fns";

export default function KidSpace() {
  const { walletId } = useParams<{ walletId: string }>();
  const effectiveUserId = useEffectiveUserId();
  const navigate = useNavigate();

  const [walletName, setWalletName] = useState("");
  const [balance, setBalance] = useState(0);
  const [goals, setGoals] = useState<KidGoal[]>([]);
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [rule, setRule] = useState<AllowanceRule | null>(null);
  const [loading, setLoading] = useState(true);

  const [badges, setBadges] = useState<KidBadge[]>([]);
  const [newBadges, setNewBadges] = useState<KidBadge[]>([]);

  // Telescope slider (projection in months)
  const [projectionMonths, setProjectionMonths] = useState([0]);

  useEffect(() => {
    if (!walletId || !effectiveUserId) return;

    let active = true;
    (async () => {
      setLoading(true);

      // Fetch wallet name
      const { data: walletData } = await supabase
        .from("wallets")
        .select("name")
        .eq("id", walletId)
        .single();

      if (walletData) {
        setWalletName(walletData.name.replace("Kids - ", ""));
      }

      // Fetch rule & materialize deposits
      const map = await fetchAllowanceRules([walletId]);
      const r = map[walletId] ?? null;
      if (r) await syncAllowanceDeposits(r, effectiveUserId);
      
      if (!active) return;
      setRule(r);

      // Fetch transactions
      const { data: txData } = await supabase
        .from("transactions")
        .select("*")
        .eq("wallet_id", walletId)
        .order("payment_date", { ascending: false });

      const txs = txData || [];
      setTransactions(txs);
      
      const { balance: bal } = computeBalances(txs);
      setBalance(bal);

      // Fetch goals
      const kidGoals = await fetchKidGoals(walletId);
      setGoals(kidGoals);

      // Evaluate badges
      const evaluated = evaluateBadges(txs, kidGoals, bal);
      setBadges(evaluated);

      const seen = getSeenBadges(walletId);
      const unlocked = evaluated.filter(b => b.unlocked);
      const newlyUnlocked = unlocked.filter(b => !seen.includes(b.id));

      if (newlyUnlocked.length > 0) {
        setNewBadges(newlyUnlocked);
        markBadgesSeen(walletId, newlyUnlocked.map(b => b.id));
      }

      setLoading(false);
    })();

    return () => { active = false; };
  }, [walletId, effectiveUserId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0f1d] text-white">
        <div className="flex flex-col items-center gap-4">
          <Rocket className="h-10 w-10 animate-bounce text-indigo-400" />
          <p>Preparando a nave espacial...</p>
        </div>
      </div>
    );
  }

  const avatar = walletId ? getKidAvatar(walletId) : null;
  
  let projectedBalance = balance;
  if (projectionMonths[0] > 0 && rule) {
    const untilDate = addMonths(new Date(), projectionMonths[0]);
    const upcoming = getUpcomingAllowances(rule, untilDate);
    projectedBalance += (upcoming.length * rule.amount);
  }

  return (
    <div className="min-h-screen bg-[#0a0f1d] text-white relative overflow-hidden font-display">
      {/* Background stars (simulated with CSS) */}
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-40 pointer-events-none mix-blend-screen" />
      
      {/* Header */}
      <header className="relative z-10 p-6 flex items-center justify-between">
        <Button variant="ghost" className="text-white hover:bg-white/10 gap-2" onClick={() => navigate("/eva-kids")}>
          <ChevronLeft className="h-4 w-4" /> Voltar para o Planeta Terra
        </Button>
        <div className="flex items-center gap-3 bg-white/10 px-4 py-2 rounded-full border border-white/20 backdrop-blur-md">
          <KidAvatar walletId={walletId!} size={32} />
          <span className="font-semibold text-lg">{walletName}</span>
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Avatar & Eva Guide */}
        <div className="lg:col-span-1 flex flex-col items-center gap-8">
          
          <div className="relative group">
            <div className="absolute -inset-4 bg-indigo-500/30 blur-2xl rounded-full group-hover:bg-indigo-500/50 transition-colors" />
            <img src={avatar?.src} alt="Avatar" className="w-48 h-48 rounded-full border-4 border-indigo-300 shadow-2xl relative z-10" />
          </div>

          <div className="bg-indigo-950/80 border border-indigo-500/30 rounded-2xl p-6 shadow-xl backdrop-blur-md w-full relative">
            <img src={EVA_GUIDE_IMAGE} alt="Eva Guia" className="w-16 h-16 rounded-full absolute -top-8 -left-4 border-2 border-indigo-400 shadow-lg" />
            <p className="mt-4 text-indigo-100 italic">
              "Olá, {walletName}! Eu sou a Eva. Seu baú estelar está com <strong className="text-amber-300">{formatBRL(balance)}</strong>. Vamos explorar o espaço?"
            </p>
          </div>
          
          {/* Badges / Conquistas */}
          <div className="w-full bg-slate-900/80 border border-white/10 rounded-2xl p-6">
            <h3 className="flex items-center gap-2 font-bold mb-4"><Trophy className="text-yellow-400 h-5 w-5" /> Suas Conquistas</h3>
            <div className="grid grid-cols-3 gap-3">
              {badges.map(b => (
                <div key={b.id} className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${b.unlocked ? 'bg-indigo-900/50 border-indigo-400' : 'bg-white/5 border-white/5 opacity-50 grayscale'}`} title={b.description}>
                  <span className="text-2xl">{b.emoji}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Telescópio & Constelações */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Telescope / Future Projection */}
          <div className="bg-gradient-to-br from-indigo-900/80 to-purple-900/80 border border-indigo-500/30 rounded-3xl p-8 shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-indigo-500/20 rounded-full">
                <Telescope className="h-6 w-6 text-indigo-300" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Telescópio do Futuro</h2>
                <p className="text-indigo-200">Gire o telescópio para ver quanto brilho você terá!</p>
              </div>
            </div>

            <div className="mb-8">
              <Slider
                value={projectionMonths}
                onValueChange={setProjectionMonths}
                max={12}
                step={1}
                className="my-6"
              />
              <div className="flex justify-between text-xs font-semibold text-indigo-300 uppercase tracking-wider">
                <span>Hoje</span>
                <span>Daqui a {projectionMonths[0]} meses</span>
              </div>
            </div>

            <div className="flex items-center justify-between bg-black/30 rounded-2xl p-6 border border-white/5">
              <div className="flex flex-col">
                <span className="text-sm text-indigo-200">Previsão de Brilho</span>
                <span className="text-4xl font-bold text-amber-300">{formatBRL(projectedBalance)}</span>
              </div>
              <Rocket className="h-12 w-12 text-indigo-400 opacity-50" />
            </div>
          </div>

          {/* Goals / Constellations */}
          <div className="bg-slate-900/80 border border-white/10 rounded-3xl p-8">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Star className="h-6 w-6 text-yellow-400" /> Suas Constelações
            </h2>
            
            {goals.length === 0 ? (
              <div className="text-center py-10 opacity-70">
                <p>Nenhuma constelação criada ainda.</p>
                <p className="text-sm mt-2">Peça para um adulto criar um sonho para você alcançar!</p>
              </div>
            ) : (
              <div className="space-y-6">
                {goals.map(goal => {
                  const percent = Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100));
                  return (
                    <div key={goal.id} className="relative p-6 bg-white/5 rounded-2xl border border-white/10 hover:border-indigo-400/50 transition-colors">
                      <div className="flex justify-between items-end mb-4">
                        <div className="flex items-center gap-3">
                          <span className="text-3xl">{goal.icon}</span>
                          <div>
                            <h3 className="font-bold text-lg">{goal.name}</h3>
                            <p className="text-sm text-indigo-200">{formatBRL(goal.current_amount)} de {formatBRL(goal.target_amount)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-bold text-emerald-400">{percent}%</span>
                        </div>
                      </div>
                      
                      <div className="relative h-4 bg-black/40 rounded-full overflow-hidden">
                        <div 
                          className="absolute top-0 left-0 h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-1000 rounded-full shadow-[0_0_10px_rgba(52,211,153,0.7)]"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* New Badge Modal */}
      {newBadges.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-indigo-950 border-2 border-amber-400 rounded-3xl p-8 max-w-sm w-full text-center relative animate-in zoom-in duration-300">
            <Button variant="ghost" size="icon" className="absolute top-2 right-2 text-white/50 hover:text-white" onClick={() => setNewBadges([])}>
              <X className="h-5 w-5" />
            </Button>
            <div className="text-6xl mb-4 animate-bounce">{newBadges[0].emoji}</div>
            <h2 className="text-2xl font-bold text-amber-400 mb-2">Nova Conquista!</h2>
            <h3 className="text-xl font-semibold mb-2">{newBadges[0].title}</h3>
            <p className="text-indigo-200 mb-6">{newBadges[0].description}</p>
            <Button className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold" onClick={() => setNewBadges(prev => prev.slice(1))}>
              Incrível!
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}
