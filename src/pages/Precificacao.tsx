import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calculator, Plus, Loader2 } from "lucide-react";
import { usePricing, type Procedure } from "@/hooks/usePricing";
import { PricingConfigCard } from "@/components/precificacao/PricingConfigCard";
import { ProcedureTable } from "@/components/precificacao/ProcedureTable";
import { ProcedureFormModal } from "@/components/precificacao/ProcedureFormModal";
import { CostBreakdownCard } from "@/components/precificacao/CostBreakdownCard";

export default function Precificacao() {
  const {
    config, costSummary, procedures, loading,
    selectedProcedure, selectedProcedureId, setSelectedProcedureId,
    saveConfig, createProcedure, updateProcedure, duplicateProcedure, deleteProcedure, calcPrice,
  } = usePricing();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProcedure, setEditingProcedure] = useState<Procedure | null>(null);

  const handleNew = () => {
    setEditingProcedure(null);
    setModalOpen(true);
  };

  const handleEdit = (proc: Procedure) => {
    setEditingProcedure(proc);
    setModalOpen(true);
  };

  const handleSaveProcedure = async (data: {
    name: string;
    execution_time: number;
    desired_price: number;
    items: { description: string; value: number }[];
  }) => {
    if (editingProcedure) {
      return updateProcedure(editingProcedure.id, data);
    }
    return createProcedure(data);
  };

  const profitMargin = config?.profit_margin ?? 30;

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
        <h1 className="text-2xl font-bold text-foreground">Precificação</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Formação de Hora Clínica (FHC) — calcule o preço ideal dos seus procedimentos
        </p>
      </div>

      {/* Config + Cost Summary */}
      <PricingConfigCard
        config={config}
        costSummary={costSummary}
        onSave={saveConfig}
        loading={loading}
      />

      {/* Procedures Table */}
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
          <ProcedureTable
            procedures={procedures}
            costSummary={costSummary}
            profitMargin={profitMargin}
            selectedId={selectedProcedureId}
            onSelect={setSelectedProcedureId}
            onEdit={handleEdit}
            onDuplicate={duplicateProcedure}
            onDelete={deleteProcedure}
            calcPrice={calcPrice}
          />
        </CardContent>
      </Card>

      {/* Cost Breakdown for selected procedure */}
      {selectedProcedure && (
        <CostBreakdownCard
          procedure={selectedProcedure}
          costSummary={costSummary}
          profitMargin={profitMargin}
          calcPrice={calcPrice}
        />
      )}

      {/* Form Modal */}
      <ProcedureFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        procedure={editingProcedure}
        costSummary={costSummary}
        profitMargin={profitMargin}
        onSave={handleSaveProcedure}
      />
    </div>
  );
}
