import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { type LucideIcon } from "lucide-react";

interface ComingSoonProps {
  title: string;
  description: string;
  icon: LucideIcon;
}

const ComingSoon = ({ title, description, icon: Icon }: ComingSoonProps) => {
  return (
    <div className="flex items-center justify-center min-h-[60vh] p-6">
      <Card className="max-w-md w-full text-center">
        <CardContent className="pt-10 pb-10 flex flex-col items-center gap-5">
          <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Icon className="h-10 w-10 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold font-display">{title}</h1>
            <p className="text-muted-foreground">{description}</p>
          </div>
          <Badge variant="secondary" className="bg-primary/10 text-primary border-0 text-sm px-4 py-1">
            Em breve
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
};

export default ComingSoon;
