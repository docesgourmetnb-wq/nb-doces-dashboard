import { useState } from 'react';
import { Search, Plus, Edit2, Trash2, Loader2, User, Mail, Phone, Eye, ShoppingBag, Calendar } from 'lucide-react';
import { useClientes, Cliente } from '@/hooks/useClientes';
import { usePedidos } from '@/hooks/usePedidos';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { getPedidoStatusLabel, getPedidoStatusBadgeClass } from '@/domain/pedidos';

export function ClientesPage() {
  const { clientes, loading, addCliente, updateCliente, deleteCliente } = useClientes();
  const { pedidos } = usePedidos();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [viewingCliente, setViewingCliente] = useState<Cliente | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Form state
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [clienteDesde, setClienteDesde] = useState<Date | undefined>(undefined);

  const filteredClientes = clientes.filter((c) =>
    c.nome.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.telefone?.includes(search)
  );

  const getClientePedidos = (clienteNome: string) => {
    return pedidos.filter(p => p.cliente.toLowerCase() === clienteNome.toLowerCase());
  };

  const getClienteStats = (clienteNome: string) => {
    const clientePedidos = getClientePedidos(clienteNome);
    const totalPedidos = clientePedidos.length;
    const totalGasto = clientePedidos.reduce((acc, p) => acc + p.valor_total, 0);
    return { totalPedidos, totalGasto };
  };

  // Status labels/classes now come from domain helpers

  const resetForm = () => {
    setNome('');
    setEmail('');
    setTelefone('');
    setClienteDesde(undefined);
    setEditingCliente(null);
  };

  const openEditDialog = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setNome(cliente.nome);
    setEmail(cliente.email || '');
    setTelefone(cliente.telefone || '');
    setClienteDesde(new Date(cliente.created_at));
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!nome.trim()) return;

    setFormLoading(true);
    try {
      if (editingCliente) {
        await updateCliente(editingCliente.id, {
          nome: nome.trim(),
          email: email.trim() || null,
          telefone: telefone.trim() || null,
          ...(clienteDesde && { created_at: clienteDesde.toISOString() }),
        });
      } else {
        await addCliente({
          nome: nome.trim(),
          email: email.trim() || null,
          telefone: telefone.trim() || null,
        });
      }
      setDialogOpen(false);
      resetForm();
    } finally {
      setFormLoading(false);
    }
  };

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
          <h1 className="font-display text-3xl font-semibold text-foreground">Clientes</h1>
          <p className="text-muted-foreground mt-1">Gerencie sua base de clientes</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus size={18} />
              Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display text-xl">
                {editingCliente ? 'Editar Cliente' : 'Novo Cliente'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome do cliente"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="(11) 99999-9999"
                />
              </div>
              {editingCliente && (
                <div className="space-y-2">
                  <Label>Cliente desde</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !clienteDesde && "text-muted-foreground"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {clienteDesde ? format(clienteDesde, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "Selecione a data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-50" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={clienteDesde}
                        onSelect={setClienteDesde}
                        initialFocus
                        locale={ptBR}
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={formLoading}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmit} disabled={formLoading || !nome.trim()}>
                  {formLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : editingCliente ? 'Atualizar' : 'Cadastrar'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, email ou telefone..."
          className="pl-10"
        />
      </div>

      {/* Clients Grid */}
      {filteredClientes.length === 0 ? (
        <div className="text-center py-16">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <User className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-display font-semibold text-lg text-foreground mb-1">Nenhum cliente encontrado</h3>
          <p className="text-muted-foreground text-sm mb-4">
            {search ? 'Tente ajustar a busca.' : 'Cadastre seu primeiro cliente para começar.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClientes.map((cliente) => {
            const stats = getClienteStats(cliente.nome);
            return (
              <div
                key={cliente.id}
                className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{cliente.nome}</h3>
                      <p className="text-xs text-muted-foreground">
                        Cliente desde {format(new Date(cliente.created_at), "MMM 'de' yyyy", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setViewingCliente(cliente)}
                      className="p-2 hover:bg-muted rounded-lg transition-colors"
                    >
                      <Eye size={16} className="text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => openEditDialog(cliente)}
                      className="p-2 hover:bg-muted rounded-lg transition-colors"
                    >
                      <Edit2 size={16} className="text-muted-foreground" />
                    </button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button className="p-2 hover:bg-destructive/10 rounded-lg transition-colors">
                          <Trash2 size={16} className="text-destructive" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover cliente?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja remover {cliente.nome}? Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteCliente(cliente.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <div className="space-y-2">
                  {cliente.email && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Mail size={14} />
                      <span className="truncate">{cliente.email}</span>
                    </div>
                  )}
                  {cliente.telefone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone size={14} />
                      <span>{cliente.telefone}</span>
                    </div>
                  )}
                  {!cliente.email && !cliente.telefone && (
                    <p className="text-sm text-muted-foreground italic">Sem informações de contato</p>
                  )}
                </div>
                {/* Stats */}
                <div className="mt-4 pt-4 border-t border-border flex gap-4">
                  <div className="flex items-center gap-2 text-sm">
                    <ShoppingBag size={14} className="text-primary" />
                    <span className="text-muted-foreground">{stats.totalPedidos} pedidos</span>
                  </div>
                  <div className="text-sm font-medium text-primary">
                    R$ {stats.totalGasto.toFixed(2)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Client Detail Dialog with Order History */}
      <Dialog open={!!viewingCliente} onOpenChange={(open) => !open && setViewingCliente(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {viewingCliente && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-2xl flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  {viewingCliente.nome}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-6 py-4">
                {/* Contact Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">E-mail</p>
                    <p className="font-medium">{viewingCliente.email || '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Telefone</p>
                    <p className="font-medium">{viewingCliente.telefone || '—'}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Cliente desde</p>
                    <p className="font-medium">
                      {format(new Date(viewingCliente.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Total gasto</p>
                    <p className="font-semibold text-primary">
                      R$ {getClienteStats(viewingCliente.nome).totalGasto.toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Order History */}
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <ShoppingBag size={18} />
                    Histórico de Pedidos
                  </h3>
                  {getClientePedidos(viewingCliente.nome).length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center bg-muted/30 rounded-lg">
                      Nenhum pedido encontrado para este cliente.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {getClientePedidos(viewingCliente.nome).map((pedido) => (
                        <div
                          key={pedido.id}
                          className="p-4 bg-muted/30 rounded-lg border border-border"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Calendar size={14} />
                              {format(new Date(pedido.data), "dd/MM/yyyy", { locale: ptBR })}
                            </div>
                            <span className={cn(
                              "text-xs px-2.5 py-1 rounded-full font-medium",
                              getPedidoStatusBadgeClass(pedido.status)
                            )}>
                              {getPedidoStatusLabel(pedido.status)}
                            </span>
                          </div>
                          {pedido.itens && pedido.itens.length > 0 && (
                            <div className="text-sm text-muted-foreground mb-2">
                              {pedido.itens.map(item => `${item.quantidade}x ${item.brigadeiro_nome}`).join(', ')}
                            </div>
                          )}
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground capitalize">
                              {pedido.tipo_pedido.replace('-', ' ')}
                            </span>
                            <span className="font-semibold">
                              R$ {pedido.valor_total.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
