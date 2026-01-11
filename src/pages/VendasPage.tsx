import { useState } from 'react';
import { Plus, Search, Eye } from 'lucide-react';
import { pedidos as initialPedidos, brigadeiros } from '@/data/mockData';
import { Pedido, ItemPedido } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function VendasPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>(initialPedidos);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);

  const statusLabels = {
    'pendente': { label: 'Pendente', class: 'bg-muted text-muted-foreground' },
    'em-producao': { label: 'Em Produção', class: 'bg-info/20 text-info' },
    'pronto': { label: 'Pronto', class: 'bg-warning/20 text-warning' },
    'entregue': { label: 'Entregue', class: 'bg-success/20 text-success' },
    'cancelado': { label: 'Cancelado', class: 'bg-destructive/20 text-destructive' },
  };

  const pagamentoLabels = {
    'pix': 'PIX',
    'cartao': 'Cartão',
    'dinheiro': 'Dinheiro',
    'transferencia': 'Transferência',
  };

  const filteredPedidos = pedidos.filter((p) => {
    const matchesSearch = p.cliente.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'todos' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const updateStatus = (pedidoId: string, novoStatus: Pedido['status']) => {
    setPedidos(pedidos.map(p => 
      p.id === pedidoId ? { ...p, status: novoStatus } : p
    ));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-foreground">Vendas</h1>
          <p className="text-muted-foreground mt-1">Gerencie seus pedidos</p>
        </div>
        <Button className="gap-2">
          <Plus size={18} />
          Novo Pedido
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por cliente..."
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="em-producao">Em Produção</SelectItem>
            <SelectItem value="pronto">Pronto</SelectItem>
            <SelectItem value="entregue">Entregue</SelectItem>
            <SelectItem value="cancelado">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Orders Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-4 font-medium text-sm">Pedido</th>
                <th className="text-left p-4 font-medium text-sm">Cliente</th>
                <th className="text-left p-4 font-medium text-sm">Data</th>
                <th className="text-left p-4 font-medium text-sm">Itens</th>
                <th className="text-left p-4 font-medium text-sm">Total</th>
                <th className="text-left p-4 font-medium text-sm">Pagamento</th>
                <th className="text-left p-4 font-medium text-sm">Status</th>
                <th className="text-left p-4 font-medium text-sm">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredPedidos.map((pedido) => (
                <tr key={pedido.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                  <td className="p-4 font-medium">#{pedido.id}</td>
                  <td className="p-4">{pedido.cliente}</td>
                  <td className="p-4 text-muted-foreground">
                    {format(pedido.data, 'dd/MM/yyyy', { locale: ptBR })}
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-muted-foreground">
                      {pedido.itens.reduce((acc, item) => acc + item.quantidade, 0)} un.
                    </span>
                  </td>
                  <td className="p-4 font-semibold">
                    R$ {pedido.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-4">
                    <span className="text-sm">{pagamentoLabels[pedido.formaPagamento]}</span>
                  </td>
                  <td className="p-4">
                    <Select
                      value={pedido.status}
                      onValueChange={(value: Pedido['status']) => updateStatus(pedido.id, value)}
                    >
                      <SelectTrigger className={cn(
                        "h-8 text-xs font-medium border-0",
                        statusLabels[pedido.status].class
                      )}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="em-producao">Em Produção</SelectItem>
                        <SelectItem value="pronto">Pronto</SelectItem>
                        <SelectItem value="entregue">Entregue</SelectItem>
                        <SelectItem value="cancelado">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-4">
                    <Dialog>
                      <DialogTrigger asChild>
                        <button 
                          onClick={() => setSelectedPedido(pedido)}
                          className="p-2 hover:bg-muted rounded-lg transition-colors"
                        >
                          <Eye size={18} className="text-muted-foreground" />
                        </button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle className="font-display">
                            Pedido #{pedido.id}
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Cliente</p>
                              <p className="font-medium">{pedido.cliente}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Data</p>
                              <p className="font-medium">
                                {format(pedido.data, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                              </p>
                            </div>
                          </div>
                          <div>
                            <p className="text-muted-foreground text-sm mb-2">Itens</p>
                            <div className="space-y-2">
                              {pedido.itens.map((item, index) => (
                                <div key={index} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                                  <div>
                                    <p className="font-medium">{item.brigadeiroNome}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {item.quantidade} x R$ {item.precoUnitario.toFixed(2)}
                                    </p>
                                  </div>
                                  <p className="font-semibold">
                                    R$ {(item.quantidade * item.precoUnitario).toFixed(2)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="pt-4 border-t border-border flex justify-between items-center">
                            <span className="font-medium">Total</span>
                            <span className="text-2xl font-display font-semibold text-primary">
                              R$ {pedido.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
