import { useState } from "react";
import { GraduationCap, Wallet, ArrowUpCircle, ArrowDownCircle, PlusCircle, Settings, History, CalendarIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { format } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

type Transaction = {
  id: string;
  type: 'receita' | 'despesa';
  title: string;
  amount: number;
  date: string;
  category: string;
};

export default function EvaKids() {
  const { user } = useAuth();
  
  // Dummy data / State for Eva Kids Checking Account
  const [allowance, setAllowance] = useState(50.00);
  const [transactions, setTransactions] = useState<Transaction[]>([
    { id: '1', type: 'receita', title: 'Mesada - Outubro', amount: 50.00, date: '2026-10-01', category: 'Mesada' },
    { id: '2', type: 'despesa', title: 'Compra na Cantina', amount: 15.50, date: '2026-10-02', category: 'Alimentação' },
    { id: '3', type: 'despesa', title: 'Brinquedo', amount: 30.00, date: '2026-10-05', category: 'Lazer' },
    { id: '4', type: 'receita', title: 'Presente Vó', amount: 100.00, date: '2026-10-12', category: 'Presentes' },
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'receita' | 'despesa'>('despesa');
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    category: '',
    paymentMethod: 'dinheiro'
  });

  const balance = transactions.reduce((acc, curr) => {
    return curr.type === 'receita' ? acc + curr.amount : acc - curr.amount;
  }, 0);

  const openModal = (type: 'receita' | 'despesa') => {
    setModalType(type);
    setFormData({
      title: '',
      amount: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      category: '',
      paymentMethod: 'dinheiro'
    });
    setIsModalOpen(true);
  };

  const handleSaveTransaction = () => {
    if (!formData.title || !formData.amount || !formData.date) {
      toast.error("Preencha os campos obrigatórios (Descrição, Valor e Data).");
      return;
    }

    const newTx: Transaction = {
      id: crypto.randomUUID(),
      type: modalType,
      title: formData.title,
      amount: parseFloat(formData.amount.replace(',', '.')),
      date: formData.date,
      category: formData.category || 'Geral'
    };

    setTransactions([newTx, ...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    setIsModalOpen(false);
    toast.success(modalType === 'receita' ? "Fundo adicionado com sucesso!" : "Gasto registrado com sucesso!");
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-4 md:p-6 animate-fade-in">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold font-display tracking-tight text-foreground">EVA Kids</h1>
        </div>
        <p className="text-muted-foreground">Gerencie a mesada e as finanças das crianças de forma educativa.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Main Balance Card */}
        <Card className="md:col-span-2 border-primary/20 shadow-premium glow-primary-sm bg-gradient-primary-soft relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Wallet className="w-32 h-32" />
          </div>
          <CardHeader>
            <CardTitle className="text-primary flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Conta Corrente Kids
            </CardTitle>
            <CardDescription>Saldo disponível para gastos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold font-display text-primary">
              R$ {balance.toFixed(2).replace('.', ',')}
            </div>
            
            <div className="mt-8 flex gap-4">
              <Button onClick={() => openModal('receita')} className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2">
                <ArrowUpCircle className="h-4 w-4" />
                Adicionar Fundo
              </Button>
              <Button onClick={() => openModal('despesa')} variant="outline" className="flex-1 text-destructive hover:bg-destructive/10 hover:text-destructive gap-2 border-destructive/20">
                <ArrowDownCircle className="h-4 w-4" />
                Registrar Gasto
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Settings Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="h-5 w-5 text-muted-foreground" />
              Regras de Mesada
            </CardTitle>
            <CardDescription>Defina o valor e frequência</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Valor da Mesada (R$)</Label>
              <Input 
                type="number" 
                value={allowance} 
                onChange={(e) => setAllowance(Number(e.target.value))}
                className="font-medium"
              />
            </div>
            <div className="space-y-2">
              <Label>Frequência</Label>
              <select className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50">
                <option value="monthly">Mensal</option>
                <option value="weekly">Semanal</option>
              </select>
            </div>
            <Button variant="secondary" className="w-full gap-2 mt-2" onClick={() => toast.success("Regras atualizadas!")}>
              <PlusCircle className="h-4 w-4" />
              Salvar Regras
            </Button>
          </CardContent>
        </Card>

        {/* Transactions History */}
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-5 w-5 text-muted-foreground" />
              Histórico Recente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma movimentação registrada.</p>
              ) : transactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    {tx.type === 'receita' ? (
                      <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-full">
                        <ArrowUpCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                    ) : (
                      <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-full">
                        <ArrowDownCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-sm">{tx.title}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3" />
                        {new Date(tx.date + 'T12:00:00').toLocaleDateString('pt-BR')} 
                        <span className="ml-1 px-2 py-0.5 bg-muted rounded-full text-[10px]">{tx.category}</span>
                      </p>
                    </div>
                  </div>
                  <div className={`font-semibold ${tx.type === 'receita' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {tx.type === 'receita' ? '+' : '-'} R$ {tx.amount.toFixed(2).replace('.', ',')}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{modalType === 'receita' ? 'Adicionar Fundo' : 'Registrar Gasto'}</DialogTitle>
            <DialogDescription>
              Preencha os detalhes abaixo para {modalType === 'receita' ? 'adicionar saldo à conta' : 'registrar uma despesa'}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Descrição</Label>
              <Input 
                id="title" 
                placeholder={modalType === 'receita' ? "Ex: Presente da Vó, Mesada" : "Ex: Lanche, Brinquedo"} 
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Valor (R$)</Label>
                <Input 
                  id="amount" 
                  type="number"
                  step="0.01"
                  placeholder="0,00" 
                  value={formData.amount}
                  onChange={(e) => setFormData({...formData, amount: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Data</Label>
                <Input 
                  id="date" 
                  type="date" 
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categoria / Pasta</Label>
              <Input 
                id="category" 
                placeholder="Ex: Mesada, Alimentação, Lazer" 
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentMethod">Forma de Pagamento</Label>
              <select 
                id="paymentMethod"
                disabled
                className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-muted px-3 py-2 text-sm shadow-sm opacity-70 cursor-not-allowed"
                value={formData.paymentMethod}
              >
                <option value="dinheiro">Dinheiro</option>
              </select>
              <p className="text-[10px] text-muted-foreground">Forma de pagamento fixa para Conta Kids no momento.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveTransaction}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
