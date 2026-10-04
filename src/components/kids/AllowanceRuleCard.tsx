import { useEffect, useState } from "react";
import { CalendarClock, CheckCircle2, Loader2, Moon, Pencil, Settings, Sparkles, XCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { addDays, endOfYear, format, startOfDay } from "date-fns";
import {
  type AllowanceRule,
  WEEKDAYS,
  deleteAllowanceRule,
  describeRule,
  formatBRL,
  formatShortDate,
  getAllowanceDates,
  getNextAllowanceDate,
  getUpcomingAllowances,
  relativeDayLabel,
  saveAllowanceRule,
} from "@/lib/kids";

interface AllowanceRuleCardProps {
  walletId: string;
  userId: string;
  displayName: string;
  rule: AllowanceRule | null;
  loading: boolean;
  onChange: (rule: AllowanceRule | null) => void;
}

const selectClass =
  "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background focus:outline-none focus:ring-1 focus:ring-ring";

export function AllowanceRuleCard({ walletId, userId, displayName, rule, loading, onChange }: AllowanceRuleCardProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [amount, setAmount] = useState("50");
  const [frequency, setFrequency] = useState<"weekly" | "monthly">("weekly");
  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [dayOfMonth, setDayOfMonth] = useState("5");

  // Hydrate form with the persisted rule
  useEffect(() => {
    if (!rule) return;
    setAmount(String(rule.amount));
    setFrequency(rule.frequency);
    setDayOfWeek(String(rule.day_of_week ?? 1));
    setDayOfMonth(String(rule.day_of_month ?? 5));
  }, [rule]);

  const showForm = !rule || editing;

  // Preview of the first deposit with the values currently typed
  const previewRule: AllowanceRule = {
    id: "preview",
    wallet_id: walletId,
    amount: Number(amount) || 0,
    frequency,
    day_of_week: Number(dayOfWeek),
    day_of_month: Math.min(31, Math.max(1, Number(dayOfMonth) || 5)),
    start_date: format(addDays(startOfDay(new Date()), 1), "yyyy-MM-dd"),
  };
  const previewFirst = getAllowanceDates(previewRule, new Date(previewRule.start_date + "T00:00:00"), addDays(new Date(), 400))[0];

  const handleSave = async () => {
    const value = Number(String(amount).replace(",", "."));
    if (!value || value <= 0) {
      toast.error("Informe um valor de mesada maior que zero.");
      return;
    }
    const dom = Number(dayOfMonth);
    if (frequency === "monthly" && (!dom || dom < 1 || dom > 31)) {
      toast.error("Escolha um dia do mês entre 1 e 31.");
      return;
    }
    setSaving(true);
    try {
      const saved = await saveAllowanceRule({
        existingId: rule?.id,
        userId,
        walletId,
        amount: value,
        frequency,
        dayOfWeek: Number(dayOfWeek),
        dayOfMonth: dom || 5,
      });
      const next = getNextAllowanceDate(saved);
      onChange(saved);
      setEditing(false);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2500);
      toast.success(rule ? "Mesada atualizada!" : "Mesada ativada! 🎉", {
        description: next
          ? `${formatBRL(saved.amount)} para ${displayName} — próxima em ${format(next, "dd/MM")} (${relativeDayLabel(next)}).`
          : undefined,
      });
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível salvar a mesada. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!rule) return;
    if (!confirm(`Encerrar a mesada automática de ${displayName}? Os depósitos já feitos continuam no histórico.`)) return;
    try {
      await deleteAllowanceRule(rule.id);
      onChange(null);
      setEditing(false);
      toast.success("Mesada automática encerrada.");
    } catch {
      toast.error("Erro ao encerrar a mesada.");
    }
  };

  // ── Loading ──
  if (loading) {
    return (
      <Card>
        <CardContent className="h-full min-h-[260px] flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // ── Active summary ──
  if (!showForm && rule) {
    const next = getNextAllowanceDate(rule);
    const upcoming = getUpcomingAllowances(rule);
    const timeline = getUpcomingAllowances(rule, addDays(new Date(), 400)).slice(0, 4);
    return (
      <Card
        id="allowance-rule-card"
        className={`relative overflow-hidden border-emerald-500/30 transition-shadow duration-700 ${justSaved ? "ring-2 ring-emerald-400/70 shadow-[0_0_30px_-5px_rgba(16,185,129,0.5)]" : ""}`}
      >
        <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-emerald-400/10 blur-2xl pointer-events-none" />
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Moon className="h-5 w-5 text-indigo-400" />
              Mesada
            </CardTitle>
            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/15 gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              Ativa
            </Badge>
          </div>
          <CardDescription>Depósito automático na conta de {displayName}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
          <div>
            <p className="text-2xl font-bold font-display tracking-tight">
              {formatBRL(rule.amount)}
              <span className="text-sm font-medium text-muted-foreground"> / {rule.frequency === "weekly" ? "semana" : "mês"}</span>
            </p>
            <p className="text-sm text-muted-foreground">{describeRule(rule)}</p>
          </div>

          {next && (
            <div className="rounded-xl border border-amber-400/30 bg-gradient-to-br from-amber-400/15 via-amber-300/5 to-transparent p-3">
              <p className="text-[11px] uppercase tracking-wider font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <CalendarClock className="h-3.5 w-3.5" /> Próxima mesada
              </p>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-lg font-semibold capitalize">{formatShortDate(next)}</span>
                <Badge variant="outline" className="border-amber-400/40 text-amber-700 dark:text-amber-300">{relativeDayLabel(next)}</Badge>
              </div>
            </div>
          )}

          {/* Mini timeline */}
          <div>
            <p className="text-xs text-muted-foreground mb-2">Próximos depósitos</p>
            <div className="relative flex justify-between">
              <div className="absolute top-[7px] left-2 right-2 h-px bg-gradient-to-r from-amber-400/60 via-indigo-400/40 to-indigo-400/10" />
              {timeline.map((d, i) => (
                <div key={d.toISOString()} className="relative flex flex-col items-center gap-1">
                  <span className={`h-3.5 w-3.5 rounded-full border-2 ${i === 0 ? "bg-amber-400 border-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.8)]" : "bg-background border-indigo-400/50"}`} />
                  <span className="text-[10px] text-muted-foreground">{format(d, "dd/MM")}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            Até {format(endOfYear(new Date()), "dd/MM")}: <strong className="text-foreground">{upcoming.length} mesadas</strong> · +{formatBRL(upcoming.length * rule.amount)}
          </div>

          <div className="flex gap-2">
            <Button id="allowance-edit-btn" variant="outline" className="flex-1 gap-2" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4" /> Editar
            </Button>
            <Button id="allowance-stop-btn" variant="ghost" className="gap-2 text-muted-foreground hover:text-destructive" onClick={handleDelete}>
              <XCircle className="h-4 w-4" /> Encerrar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Form ──
  return (
    <Card id="allowance-rule-card">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Settings className="h-5 w-5 text-muted-foreground" />
          {rule ? "Editar Mesada" : "Regras de Mesada"}
        </CardTitle>
        <CardDescription>A mesada cai automaticamente na conta de {displayName}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="space-y-2">
            <Label htmlFor="allowance-amount">Valor da Mesada (R$)</Label>
            <Input id="allowance-amount" type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="font-medium" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="allowance-frequency">Frequência</Label>
            <select id="allowance-frequency" className={selectClass} value={frequency} onChange={(e) => setFrequency(e.target.value as "monthly" | "weekly")}>
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensal</option>
            </select>
          </div>
          {frequency === "weekly" ? (
            <div className="space-y-2 animate-in fade-in zoom-in duration-300">
              <Label htmlFor="allowance-dow">Dia da Semana</Label>
              <select id="allowance-dow" className={selectClass} value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)}>
                {WEEKDAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
              </select>
            </div>
          ) : (
            <div className="space-y-2 animate-in fade-in zoom-in duration-300">
              <Label htmlFor="allowance-dom">Dia do Mês</Label>
              <Input id="allowance-dom" type="number" min="1" max="31" value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} className="font-medium" placeholder="Ex: 5" />
            </div>
          )}

          {previewFirst && Number(amount) > 0 && (
            <div className="rounded-lg border border-dashed border-amber-400/40 bg-amber-400/5 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-amber-500 shrink-0" />
              <span>
                1ª mesada de <strong className="text-foreground">{formatBRL(Number(amount))}</strong> cairá{" "}
                <strong className="text-foreground capitalize">{formatShortDate(previewFirst)}</strong> ({relativeDayLabel(previewFirst)})
              </span>
            </div>
          )}

          <div className="flex gap-2">
            {rule && (
              <Button variant="ghost" onClick={() => setEditing(false)} disabled={saving}>Cancelar</Button>
            )}
            <Button id="allowance-save-btn" className="flex-1 gap-2" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {saving ? "Salvando..." : rule ? "Salvar alterações" : "Ativar Mesada"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
