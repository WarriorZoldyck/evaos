import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Users, Plus, Search, Pencil, Trash2, Building2, User } from "lucide-react";
import { useContacts, type Supplier, type Client } from "@/hooks/useContacts";
import { useCompany } from "@/contexts/CompanyContext";
import { ContactFormModal } from "@/components/contatos/ContactFormModal";
import { Skeleton } from "@/components/ui/skeleton";

export default function Contatos() {
  const {
    suppliers,
    clients,
    loading,
    search,
    setSearch,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    createClient,
    updateClient,
    deleteClient,
  } = useContacts();
  const { companies } = useCompany();

  const [activeTab, setActiveTab] = useState("suppliers");
  const [formOpen, setFormOpen] = useState(false);
  const [formType, setFormType] = useState<"supplier" | "client">("supplier");
  const [editData, setEditData] = useState<{ id: string; name: string; document?: string; company_id?: string | null } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; type: "supplier" | "client" } | null>(null);

  const contextLabel = (companyId: string | null | undefined) =>
    companyId ? (companies.find((c) => c.id === companyId)?.name || "Empresa") : "Pessoal";

  const openCreate = (type: "supplier" | "client") => {
    setFormType(type);
    setEditData(null);
    setFormOpen(true);
  };

  const openEditSupplier = (s: Supplier) => {
    setFormType("supplier");
    setEditData({ id: s.id, name: s.name, document: s.cnpj || undefined, company_id: s.company_id });
    setFormOpen(true);
  };

  const openEditClient = (c: Client) => {
    setFormType("client");
    setEditData({ id: c.id, name: c.name, document: c.cnpj_cpf || undefined, company_id: c.company_id });
    setFormOpen(true);
  };

  const handleSave = async (data: { name: string; document?: string; company_id?: string | null }) => {
    if (formType === "supplier") {
      if (editData) {
        return updateSupplier(editData.id, { name: data.name, cnpj: data.document, company_id: data.company_id });
      }
      return createSupplier({ name: data.name, cnpj: data.document, company_id: data.company_id });
    } else {
      if (editData) {
        return updateClient(editData.id, { name: data.name, cnpj_cpf: data.document, company_id: data.company_id });
      }
      return createClient({ name: data.name, cnpj_cpf: data.document, company_id: data.company_id });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === "supplier") {
      await deleteSupplier(deleteTarget.id);
    } else {
      await deleteClient(deleteTarget.id);
    }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Fornecedores e Clientes</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie seus contatos comerciais</p>
        </div>
        <Button
          onClick={() => openCreate(activeTab === "suppliers" ? "supplier" : "client")}
          className="shrink-0"
        >
          <Plus className="h-4 w-4 mr-2" />
          {activeTab === "suppliers" ? "Novo Fornecedor" : "Novo Cliente"}
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou documento..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="suppliers" className="gap-2">
            <Building2 className="h-4 w-4" />
            Fornecedores
            <Badge variant="secondary" className="ml-1 text-xs">
              {suppliers.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="clients" className="gap-2">
            <User className="h-4 w-4" />
            Clientes
            <Badge variant="secondary" className="ml-1 text-xs">
              {clients.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="suppliers">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : suppliers.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
                  <Building2 className="h-8 w-8 opacity-50" />
                  {search ? "Nenhum fornecedor encontrado" : "Nenhum fornecedor cadastrado"}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead className="w-24 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {suppliers.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell className="text-muted-foreground">{s.cnpj || "—"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditSupplier(s)}
                              className="h-8 w-8"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteTarget({ id: s.id, name: s.name, type: "supplier" })}
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="clients">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : clients.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
                  <User className="h-8 w-8 opacity-50" />
                  {search ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF/CNPJ</TableHead>
                      <TableHead className="w-24 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-muted-foreground">{c.cnpj_cpf || "—"}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditClient(c)}
                              className="h-8 w-8"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteTarget({ id: c.id, name: c.name, type: "client" })}
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Form Modal */}
      <ContactFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        type={formType}
        editData={editData}
        onSave={handleSave}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {deleteTarget?.type === "supplier" ? "fornecedor" : "cliente"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
