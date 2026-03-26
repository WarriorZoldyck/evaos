import { useState } from "react";
import { useAIPendingTransactions, AIPendingTransaction } from "@/hooks/useAIPendingTransactions";
import { useCategories } from "@/hooks/useCategories";
import { useAccounts } from "@/hooks/useAccounts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles,
  Check,
  X,
  ExternalLink,
  MessageSquare,
  Mail,
  Upload,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  Tag,
  CreditCard,
  Building2,
  User,
  FileText,
  Clock,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

function PendingCard({
  item,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
  categoryName,
  accountName,
}: {
  item: AIPendingTransaction;
  onApprove: () => void;
  onReject: () => void;
  isApproving: boolean;
  isRejecting: boolean;
  categoryName: string;
  accountName: string;
}) {
  const isReceita = item.type === "receita";
  const formattedAmount = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(item.amount);

  const formattedDate = item.competence_date
    ? format(parseISO(item.competence_date), "dd/MM/yyyy", { locale: ptBR })
    : "—";

  const sourceIcon = item.source === "whatsapp" ? MessageSquare : item.source === "email" ? Mail : Upload;
  const SourceIcon = sourceIcon;

  return (
    <Card className="border-l-4 transition-all hover:shadow-md" style={{ borderLeftColor: isReceita ? "hsl(var(--chart-2))" : "hsl(var(--chart-1))" }}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2">
            {/* Header */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="gap-1 text-xs">
                <SourceIcon className="h-3 w-3" />
                {item.source === "whatsapp" ? "WhatsApp" : item.source === "email" ? "E-mail" : "Upload"}
              </Badge>
              <Badge variant={isReceita ? "default" : "destructive"} className="gap-1 text-xs">
                {isReceita ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                {isReceita ? "Receita" : "Despesa"}
              </Badge>
              {item.transaction_status === "Pendente" && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Clock className="h-3 w-3" />
                  Pendente
                </Badge>
              )}
            </div>

            {/* Description & Amount */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-foreground">{item.description}</p>
                {item.contact_name && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <User className="h-3 w-3" />
                    {item.contact_name}
                  </p>
                )}
              </div>
              <span className={`text-lg font-bold whitespace-nowrap ${isReceita ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                {isReceita ? "+" : "-"}{formattedAmount}
              </span>
            </div>

            {/* Details */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formattedDate}
              </span>
              {categoryName && (
                <span className="flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  {categoryName}
                </span>
              )}
              {accountName && (
                <span className="flex items-center gap-1">
                  <CreditCard className="h-3 w-3" />
                  {accountName}
                </span>
              )}
              {item.payment_method && (
                <span className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {item.payment_method}
                </span>
              )}
            </div>

            {/* Original message preview */}
            {item.original_message && (
              <p className="text-xs text-muted-foreground/70 italic truncate max-w-md">
                "{item.original_message.replace("[Via WhatsApp] ", "")}"
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
          <Button
            size="sm"
            onClick={onApprove}
            disabled={isApproving || isRejecting}
            className="gap-1.5"
          >
            <Check className="h-3.5 w-3.5" />
            Aprovar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onReject}
            disabled={isApproving || isRejecting}
            className="gap-1.5 text-destructive hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
            Rejeitar
          </Button>
          {item.attachment_url && (
            <Button
              size="sm"
              variant="ghost"
              asChild
              className="gap-1.5 ml-auto"
            >
              <a href={item.attachment_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Ver anexo
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AnalisesEva() {
  const {
    pendingTransactions,
    reviewedTransactions,
    pendingCount,
    isLoading,
    approve,
    reject,
    isApproving,
    isRejecting,
  } = useAIPendingTransactions();

  const { categories } = useCategories();
  const { bankAccounts: accounts, creditCards, wallets } = useAccounts();

  const getCategoryName = (id: string | null) => {
    if (!id) return "";
    const cat = categories.find((c) => c.id === id);
    return cat?.name || "";
  };

  const getAccountName = (item: AIPendingTransaction) => {
    if (item.credit_card_id) {
      const cc = creditCards.find((c) => c.id === item.credit_card_id);
      return cc?.name || "";
    }
    if (item.bank_account_id) {
      const acc = accounts.find((a) => a.id === item.bank_account_id);
      return acc?.name || "";
    }
    if (item.wallet_id) {
      const w = wallets.find((w) => w.id === item.wallet_id);
      return w?.name || "";
    }
    return "";
  };

  const whatsappPending = pendingTransactions.filter((t) => t.source === "whatsapp");
  const otherPending = pendingTransactions.filter((t) => t.source !== "whatsapp");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Análises EVA</h1>
            <p className="text-sm text-muted-foreground">
              Revise e aprove os lançamentos gerados pela IA
            </p>
          </div>
          {pendingCount > 0 && (
            <Badge className="ml-2 text-sm px-3 py-1">{pendingCount} pendente{pendingCount > 1 ? "s" : ""}</Badge>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="whatsapp">
        <TabsList>
          <TabsTrigger value="whatsapp" className="gap-1.5">
            <MessageSquare className="h-4 w-4" />
            WhatsApp
            {whatsappPending.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{whatsappPending.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="outros" className="gap-1.5">
            <Mail className="h-4 w-4" />
            Outros
            {otherPending.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{otherPending.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="historico" className="gap-1.5">
            <Clock className="h-4 w-4" />
            Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="whatsapp" className="mt-4 space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full rounded-lg" />
            ))
          ) : whatsappPending.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">Nenhum lançamento do WhatsApp pendente de aprovação.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Envie documentos e comprovantes pelo WhatsApp para a EVA processar.</p>
              </CardContent>
            </Card>
          ) : (
            whatsappPending.map((item) => (
              <PendingCard
                key={item.id}
                item={item}
                onApprove={() => approve(item)}
                onReject={() => reject(item.id)}
                isApproving={isApproving}
                isRejecting={isRejecting}
                categoryName={getCategoryName(item.category)}
                accountName={getAccountName(item)}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="outros" className="mt-4 space-y-3">
          {otherPending.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Mail className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">Nenhum lançamento de outras fontes pendente.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Em breve: integração com e-mail e upload direto.</p>
              </CardContent>
            </Card>
          ) : (
            otherPending.map((item) => (
              <PendingCard
                key={item.id}
                item={item}
                onApprove={() => approve(item)}
                onReject={() => reject(item.id)}
                isApproving={isApproving}
                isRejecting={isRejecting}
                categoryName={getCategoryName(item.category)}
                accountName={getAccountName(item)}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="historico" className="mt-4 space-y-3">
          {reviewedTransactions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">Nenhum lançamento revisado ainda.</p>
              </CardContent>
            </Card>
          ) : (
            reviewedTransactions.map((item) => (
              <Card key={item.id} className="opacity-60">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{item.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.amount)}
                        {" · "}
                        {item.reviewed_at ? format(parseISO(item.reviewed_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : ""}
                      </p>
                    </div>
                    <Badge variant={item.status === "approved" ? "default" : "destructive"}>
                      {item.status === "approved" ? "Aprovado" : "Rejeitado"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
