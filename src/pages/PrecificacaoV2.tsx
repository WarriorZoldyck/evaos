import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calculator, Plus, Loader2 } from "lucide-react";
import { usePricingV2, type ProcedureV2, type CostGroup, COST_GROUP_LABELS } from "@/hooks/usePricingV2";
import { ConfigCard } from "@/components/precificacao-v2/ConfigCard";
import { CostItemsTab } from "@/components/precificacao-v2/CostItemsTab";
import { CostSummaryCards } from "@/components/precificacao-v2/CostSummaryCards";
import { ProcedureTableV2 } from "@/components/precificacao-v2/ProcedureTableV2";
import { ProcedureFormModalV2 } from "@/components/precificacao-v2/ProcedureFormModalV2";


const GROUPS: CostGroup[] = ["fixos_clinica", "variaveis_clinica", "pessoais"];
const GROUP_TAB_LABELS: Record<CostGroup, string> = {
  fixos_clinica: "Fixos Clínica",
  variaveis_clinica: "Variáveis Clínica",
  pessoais: "Pessoais (Casa)",
};

export default function PrecificacaoV2() {
  const {
    config, costItems, procedures, loading,
    groupTotals, custoHora, fmm, fmmPorSala, custoHoraPorSala,
    hoursPerMonth, availableHoursMonth, productiveHoursMonth, productiveLossPct, numRooms, taxRate,
    selectedProcedureId, setSelectedProcedureId,
    saveConfig, addCostItem, updateCostItem, deleteCostItem,
    createProcedure, updateProcedure, duplicateProcedure, deleteProcedure, calcProcedure,
    calcParts,

    inlineUpdateProcedure,
  } = usePricingV2();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProcedure, setEditingProcedure] = useState<ProcedureV2 | null>(null);

  const handleNew = () => { setEditingProcedure(null); setModalOpen(true); };
  const handleEdit = (proc: ProcedureV2) => { setEditingProcedure(proc); setModalOpen(true); };

  const handleSaveProcedure = async (data: {
    name: string; execution_time: number; desired_price: number; quantity: number;
    items: { description: string; value: number; unit_type: "sessao" | "unitario" }[];
  }) => {
    if (editingProcedure) return updateProcedure(editingProcedure.id, data);
    return createProcedure(data);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Precificação V2</h1>
        <p className="text-muted-foreground text-sm mt-1">
          FHC completo com custo de vida pessoal integrado — cadastre todos os custos e calcule lucratividade por procedimento
        </p>
      </div>

      {/* Seção 1: Config */}
      <ConfigCard
        hoursPerMonth={config?.hours_per_month ?? 160}
        numRooms={numRooms}
        taxRate={taxRate}
        daysPerWeek={config?.days_per_week ?? null}
        hoursPerDay={config?.hours_per_day ?? null}
        productiveLossPct={config?.productive_loss_pct ?? 0}
        workWeekdays={config?.work_weekdays ?? []}
        excludedDays={config?.excluded_days ?? []}
        weekdaySchedule={weekdaySchedule}
        dayOverrides={dayOverrides}
        observeHolidays={observeHolidays}
        referenceMonth={referenceMonth}
        availableHoursMonth={availableHoursMonth}
        workingDays={workingDays}
        onSave={saveConfig}
      />

      {/* Seção 2: Resumo */}
      <CostSummaryCards
        groupTotals={groupTotals}
        custoHora={custoHora}
        fmm={fmm}
        fmmPorSala={fmmPorSala}
        custoHoraPorSala={custoHoraPorSala}
        availableHours={availableHoursMonth}
        productiveHours={productiveHoursMonth}
        productiveLossPct={productiveLossPct}
      />

      {/* Seção 3: Procedimentos */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              Procedimentos
            </CardTitle>
            <Button onClick={handleNew} size="sm" className="gap-1">
              <Plus className="h-4 w-4" /> Novo Procedimento
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-[440px] overflow-auto">
            <ProcedureTableV2
              procedures={procedures}
              calcProcedure={calcProcedure}
              selectedId={selectedProcedureId}
              onSelect={setSelectedProcedureId}
              onEdit={handleEdit}
              onDuplicate={duplicateProcedure}
              onDelete={deleteProcedure}
              onInlineUpdate={(id, data) => {
                inlineUpdateProcedure(id, data);
              }}
              calcParts={calcParts}
              taxRate={taxRate}
            />
          </div>
        </CardContent>
      </Card>




      {/* Seção 4: Despesas em Tabs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Despesas</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="fixos_clinica">
            <TabsList className="w-full grid grid-cols-3">
              {GROUPS.map((g) => (
                <TabsTrigger key={g} value={g}>{GROUP_TAB_LABELS[g]}</TabsTrigger>
              ))}
            </TabsList>
            {GROUPS.map((g) => (
              <TabsContent key={g} value={g}>
                <CostItemsTab
                  group={g}
                  items={costItems}
                  onAdd={addCostItem}
                  onUpdate={updateCostItem}
                  onDelete={deleteCostItem}
                />
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Modal */}
      <ProcedureFormModalV2
        open={modalOpen}
        onOpenChange={setModalOpen}
        procedure={editingProcedure}
        custoHora={custoHoraPorSala}
        taxRate={taxRate}
        onSave={handleSaveProcedure}
      />
    </div>
  );
}
