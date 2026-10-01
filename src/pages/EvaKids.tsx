import { useState } from "react";
import { GraduationCap, Wallet, ArrowUpCircle, ArrowDownCircle, PlusCircle, Settings, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";

export default function EvaKids() {
  const { user } = useAuth();
  
  // Dummy data for visual representation of Eva Kids Checking Account
  const [balance, setBalance] = useState(150.00);
  const [allowance, setAllowance] = useState(50.00);

  const transactions = [
    { id: 1, type: 'receita', title: 'Mesada - Outubro', amount: 50.00, date: '01/10/2026' },
    { id: 2, type: 'despesa', title: 'Compra na Cantina', amount: 15.50, date: '02/10/2026' },
    { id: 3, type: 'despesa', title: 'Brinquedo', amount: 30.00, date: '05/10/2026' },
    { id: 4, type: 'receita', title: 'Presente Vó', amount: 100.00, date: '12/10/2026' },
  ];

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
              <Button className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2">
                <ArrowUpCircle className="h-4 w-4" />
                Adicionar Fundo
              </Button>
              <Button variant="outline" className="flex-1 text-destructive hover:bg-destructive/10 hover:text-destructive gap-2 border-destructive/20">
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
              Configurar Mesada
            </CardTitle>
            <CardDescription>Defina o valor recorrente</CardDescription>
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
            <Button variant="secondary" className="w-full gap-2 mt-2">
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
              {transactions.map(tx => (
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
                      <p className="text-xs text-muted-foreground">{tx.date}</p>
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
    </div>
  );
}
