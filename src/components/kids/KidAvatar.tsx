import { useState } from "react";
import { Check } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { KID_AVATARS, getKidAvatar, setKidAvatar } from "@/lib/kids";
import { cn } from "@/lib/utils";

interface KidAvatarProps {
  walletId: string;
  size?: number;
  className?: string;
  /** When true, clicking opens the avatar picker */
  editable?: boolean;
  displayName?: string;
  onChange?: () => void;
}

export function KidAvatar({ walletId, size = 64, className, editable = false, displayName, onChange }: KidAvatarProps) {
  const [open, setOpen] = useState(false);
  const [, force] = useState(0);
  const avatar = getKidAvatar(walletId);

  const img = (
    <img
      src={avatar.src}
      alt={`Avatar ${avatar.name}`}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={cn("rounded-full object-cover ring-2 shadow-[0_0_18px_-4px_rgba(251,191,36,0.6)]", avatar.ring, className)}
      draggable={false}
    />
  );

  if (!editable) return img;

  return (
    <>
      <button
        type="button"
        id={`kid-avatar-${walletId}`}
        title="Trocar avatar"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className="relative rounded-full transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
      >
        {img}
        <span className="absolute -bottom-1 -right-1 rounded-full bg-amber-400 text-indigo-950 text-[9px] font-bold px-1.5 py-0.5 shadow">trocar</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Escolha o avatar{displayName ? ` de ${displayName}` : ""}</DialogTitle>
            <DialogDescription>Cada criança é um pequeno espírito de luz no céu da EVA.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-4 py-2">
            {KID_AVATARS.map((a) => {
              const selected = a.id === avatar.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  id={`avatar-option-${a.id}`}
                  onClick={() => {
                    setKidAvatar(walletId, a.id);
                    force((n) => n + 1);
                    onChange?.();
                    setOpen(false);
                  }}
                  className={cn(
                    "group relative flex flex-col items-center gap-2 rounded-xl p-2 transition-all hover:bg-muted",
                    selected && "bg-muted",
                  )}
                >
                  <img src={a.src} alt={a.name} className={cn("h-20 w-20 rounded-full object-cover ring-2 transition-transform group-hover:scale-105", a.ring)} />
                  <span className="text-xs font-medium">{a.name}</span>
                  {selected && (
                    <span className="absolute top-1 right-3 h-5 w-5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
