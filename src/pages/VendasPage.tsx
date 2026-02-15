import { useState } from 'react';
import { Search, Eye, Archive, ArchiveRestore, Loader2 } from 'lucide-react';
import { usePedidos, Pedido, getClienteDisplayName } from '@/hooks/usePedidos';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { NovoPedidoForm } from '@/components/NovoPedidoForm';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function VendasPage() {
  const { pedidos, loading, updatePedidoStatus, refetch, showArchived, setShowArchived, archivePedido, unarchivePedido } = usePedidos();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [archiveReason, setArchiveReason] = useState('');

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
    const displayName = getClienteDisplayName(p);
    const matchesSearch = displayName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'todos' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-foreground">Vendas</h1>
          <p className="text-muted-foreground mt-1">Gerencie seus pedidos</p>
        </div>
        <NovoPedidoForm onSuccess={refetch} />
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
        <div className="flex items-center gap-2">
          <Checkbox
            id="showArchived"
            checked={showArchived}
            onCheckedChange={(checked) => setShowArchived(!!checked)}
          />
          <Label htmlFor="showArchived" className="text-sm text-muted-foreground cursor-pointer">
            Mostrar arquivados
          </Label>
        </div>
      </div>

      {/* Orders Table */}
      {filteredPedidos.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>Nenhum pedido encontrado.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
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
                  <tr key={pedido.id} className={cn(
                    "border-t border-border hover:bg-muted/30 transition-colors",
                    pedido.archived_at && "opacity-50"
                  )}>
                    <td className="p-4 font-medium">
                      {getClienteDisplayName(pedido)}
                      {pedido.archived_at && (
                        <span className="ml-2 text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Arquivado</span>
                      )}
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {format(new Date(pedido.data), 'dd/MM/yyyy', { locale: ptBR })}
                    </td>
                    <td className="p-4">
                      <span className="text-sm text-muted-foreground">
                        {pedido.itens?.reduce((acc, item) => acc + item.quantidade, 0) || 0} un.
                      </span>
                    </td>
                    <td className="p-4 font-semibold">
                      R$ {pedido.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4">
                      <span className="text-sm">{pagamentoLabels[pedido.forma_pagamento]}</span>
                    </td>
                    <td className="p-4">
                      <Select
                        value={pedido.status}
                        onValueChange={(value: Pedido['status']) => updatePedidoStatus(pedido.id, value)}
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
                      <div className="flex items-center gap-1">
                        {/* View details */}
                        <Dialog>
                          <DialogTrigger asChild>
                            <button className="p-2 hover:bg-muted rounded-lg transition-colors">
                              <Eye size={18} className="text-muted-foreground" />
                            </button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle className="font-display">
                                Pedido - {getClienteDisplayName(pedido)}
                              </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <p className="text-muted-foreground">Cliente</p>
                                  <p className="font-medium">{getClienteDisplayName(pedido)}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Data</p>
                                  <p className="font-medium">
                                    {format(new Date(pedido.data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                  </p>
                                </div>
                              </div>
                              {pedido.archived_at && (
                                <div className="p-3 bg-muted/50 rounded-lg text-sm">
                                  <p className="text-muted-foreground">Arquivado em {format(new Date(pedido.archived_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
                                  {pedido.archived_reason && <p className="mt-1">Motivo: {pedido.archived_reason}</p>}
                                </div>
                              )}
                              {pedido.itens && pedido.itens.length > 0 && (
                                <div>
                                  <p className="text-muted-foreground text-sm mb-2">Itens</p>
                                  <div className="space-y-2">
                                    {pedido.itens.map((item, index) => (
                                      <div key={index} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                                        <div>
                                          <p className="font-medium">{item.brigadeiro_nome}</p>
                                          <p className="text-sm text-muted-foreground">
                                            {item.quantidade} x R$ {item.preco_unitario.toFixed(2)}
                                          </p>
                                        </div>
                                        <p className="font-semibold">
                                          R$ {(item.quantidade * item.preco_unitario).toFixed(2)}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div className="pt-4 border-t border-border flex justify-between items-center">
                                <span className="font-medium">Total</span>
                                <span className="text-2xl font-display font-semibold text-primary">
                                  R$ {pedido.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>

                        {/* Archive / Unarchive */}
                        {pedido.archived_at ? (
                          <button
                            className="p-2 hover:bg-muted rounded-lg transition-colors"
                            onClick={() => unarchivePedido(pedido.id)}
                            title="Desarquivar"
                          >
                            <ArchiveRestore size={18} className="text-muted-foreground" />
                          </button>
                        ) : (
                          <Dialog>
                            <DialogTrigger asChild>
                              <button className="p-2 hover:bg-muted rounded-lg transition-colors" title="Arquivar">
                                <Archive size={18} className="text-muted-foreground" />
                              </button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Arquivar Pedido</DialogTitle>
                              </DialogHeader>
                              <p className="text-sm text-muted-foreground">
                                O pedido de <strong>{getClienteDisplayName(pedido)}</strong> será arquivado. Isso não afeta o financeiro.
                              </p>
                              <Textarea
                                placeholder="Motivo (opcional)"
                                value={archiveReason}
                                onChange={(e) => setArchiveReason(e.target.value)}
                              />
                              <DialogFooter>
                                <DialogClose asChild>
                                  <Button variant="outline">Cancelar</Button>
                                </DialogClose>
                                <DialogClose asChild>
                                  <Button onClick={() => {
                                    archivePedido(pedido.id, archiveReason);
                                    setArchiveReason('');
                                  }}>
                                    Arquivar
                                  </Button>
                                </DialogClose>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
