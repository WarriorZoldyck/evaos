import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface SeriesEditDialogProps {
  open: boolean;
  onClose: () => void;
  mode: "edit" | "delete";
  onConfirm: (scope: "only" | "from" | "all") => void;
}

export function SeriesEditDialog({
  open,
  onClose,
  mode,
  onConfirm,
}: SeriesEditDialogProps) {
  const isDelete = mode === "delete";
  const title = isDelete
    ? "Excluir lançamento parcelado"
    : "Editar lançamento parcelado";
  const description = isDelete
    ? "Este lançamento faz parte de uma série parcelada. O que deseja excluir?"
    : "Este lançamento faz parte de uma série parcelada. O que deseja editar?";

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2 py-2">
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => onConfirm("only")}
          >
            Apenas este lançamento
          </Button>
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => onConfirm("from")}
          >
            Este e os próximos
          </Button>
          <Button
            variant={isDelete ? "destructive" : "outline"}
            className="justify-start"
            onClick={() => onConfirm("all")}
          >
            Todos da série
          </Button>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
