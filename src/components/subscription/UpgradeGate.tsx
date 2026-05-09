import { useNavigate } from "react-router-dom";
import { Lock, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface UpgradeGateModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  reason?: string;
}

export function UpgradeGateModal({ open, onClose, title = "Recurso bloqueado", reason }: UpgradeGateModalProps) {
  const navigate = useNavigate();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">{title}</DialogTitle>
          <DialogDescription className="text-center">
            {reason || "Este recurso está disponível em um plano superior."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:justify-center gap-2">
          <Button variant="outline" onClick={onClose}>Voltar</Button>
          <Button onClick={() => { onClose(); navigate("/planos"); }} className="gap-1.5">
            <Sparkles className="h-4 w-4" />
            Fazer upgrade
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function UpgradeGateScreen({ title = "Recurso exclusivo do plano Família", reason }: { title?: string; reason?: string }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-4 p-8 rounded-2xl border border-border bg-card">
        <div className="mx-auto h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
          <Lock className="h-7 w-7 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">{title}</h2>
        <p className="text-muted-foreground">{reason || "Faça upgrade para desbloquear este recurso."}</p>
        <Button onClick={() => navigate("/planos")} className="gap-1.5">
          <Sparkles className="h-4 w-4" />
          Ver planos
        </Button>
      </div>
    </div>
  );
}
