import { useState } from 'react';
import { Plus, Calendar, Loader2, Pencil, Trash2, AlertTriangle, Cookie } from 'lucide-react';
import { useProducao, ProducaoDiaria } from '@/hooks/useProducao';
import { useBrigadeiros } from '@/hooks/useBrigadeiros';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function ProducaoPage() {
  const {
    producao, loading, showDeleted, setShowDeleted,
    addProducao, updateProducaoStatus, updateProducao, cancelProducao,
  } = useProducao();
  const { brigadeiros } = useBrigadeiros();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    data: format(new Date(), 'yyyy-MM-dd'),
    brigadeiro_id: '',
    quantidade: '',
  });

  // Edit state
  const [editItem, setEditItem] = useState<ProducaoDiaria | null>(null);
  const [editData, setEditData] = useState({ data: '', quantidade: '', status: '' as string });

  // Confirmation for editing concluido
  const [editConfirmItem, setEditConfirmItem] = useState<ProducaoDiaria | null>(null);

  // Cancel state
  const [cancelItem, setCancelItem] = useState<ProducaoDiaria | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const statusLabels: Record<string, { label: string; class: string }> = {
    'planejado': { label: 'Planejado', class: 'bg-muted text-muted-foreground' },
    'em-andamento': { label: 'Em Andamento', class: 'bg-info/20 text-info' },
    'concluido': { label: 'Concluído', class: 'bg-success/20 text-success' },
  };

  const today = format(new Date(), 'yyyy-MM-dd');
  const activeProducao = producao.filter(p => !p.deleted_at);
  const totalUnidadesHoje = activeProducao.filter(p => p.data === today).reduce((acc, p) => acc + p.quantidade, 0);
  const totalCustoHoje = activeProducao.filter(p => p.data === today).reduce((acc, p) => acc + p.custo_total, 0);

  const handleAddProducao = async () => {
    const brigadeiro = brigadeiros.find(b => b.id === formData.brigadeiro_id);
    if (!brigadeiro) return;
    setSaving(true);
    const quantidade = parseInt(formData.quantidade);
    if (quantidade <= 0) { setSaving(false); return; }
    await addProducao({
      data: formData.data,
      brigadeiro_id: brigadeiro.id,
      brigadeiro_nome: brigadeiro.nome,
      quantidade,
      custo_total: 0,
      status: 'planejado',
    });
    setSaving(false);
    setIsDialogOpen(false);
    setFormData({ data: format(new Date(), 'yyyy-MM-dd'), brigadeiro_id: '', quantidade: '' });
  };

  const openEdit = (item: ProducaoDiaria) => {
    // Guardrail: if concluido, show confirmation first
    if (item.status === 'concluido') {
      setEditConfirmItem(item);
    } else {
      setEditItem(item);
      setEditData({ data: item.data, quantidade: String(item.quantidade), status: item.status });
    }
  };

  const confirmEditConcluido = () => {
    if (!editConfirmItem) return;
    setEditItem(editConfirmItem);
    setEditData({ data: editConfirmItem.data, quantidade: String(editConfirmItem.quantidade), status: editConfirmItem.status });
    setEditConfirmItem(null);
  };

  const handleEdit = async () => {
    if (!editItem) return;
    setSaving(true);
    const updates: any = {};
    if (editData.data) updates.data = editData.data;
    if (editData.quantidade) updates.quantidade = parseInt(editData.quantidade);
    if (editData.status) updates.status = editData.status;
    await updateProducao(editItem.id, updates);
    setSaving(false);
    setEditItem(null);
  };

  const handleCancel = async () => {
    if (!cancelItem) return;
    setSaving(true);
    await cancelProducao(cancelItem.id, cancelReason);
    setSaving(false);
    setCancelItem(null);
    setCancelReason('');
  };

  // Group by date
  const producaoByDate = producao.reduce((acc, item) => {
    const dateKey = item.data;
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(item);
    return acc;
  }, {} as Record<string, ProducaoDiaria[]>);

  const sortedDates = Object.keys(producaoByDate).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

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
          <h1 className="font-display text-3xl font-semibold text-foreground">Produção</h1>
          <p className="text-muted-foreground mt-1">Planejamento e controle de produção</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus size={18} />
              Planejar Produção
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">Nova Produção</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Data</Label>
                <Input type="date" value={formData.data} onChange={(e) => setFormData({ ...formData, data: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Sabor</Label>
                <Select value={formData.brigadeiro_id} onValueChange={(v) => setFormData({ ...formData, brigadeiro_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o sabor" /></SelectTrigger>
                  <SelectContent>
                    {brigadeiros.map((b) => <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input type="number" min="1" value={formData.quantidade} onChange={(e) => setFormData({ ...formData, quantidade: e.target.value })} placeholder="Ex: 50" />
              </div>
              {formData.brigadeiro_id && formData.quantidade && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium">
                    Custo estimado: R$ {(parseInt(formData.quantidade) * (brigadeiros.find(b => b.id === formData.brigadeiro_id)?.custo_unitario || 0)).toFixed(2)}
                  </p>
                </div>
              )}
              <Button onClick={handleAddProducao} className="w-full" disabled={saving || !formData.brigadeiro_id || !formData.quantidade || parseInt(formData.quantidade) <= 0}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Adicionar à Produção
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Produção de Hoje</p>
          <p className="text-3xl font-display font-semibold mt-1">{totalUnidadesHoje} un.</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Custo Total Hoje</p>
          <p className="text-3xl font-display font-semibold mt-1">R$ {totalCustoHoje.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      {/* Show deleted filter */}
      <div className="flex items-center gap-2">
        <Checkbox id="show-deleted" checked={showDeleted} onCheckedChange={(v) => setShowDeleted(!!v)} />
        <Label htmlFor="show-deleted" className="text-sm text-muted-foreground cursor-pointer">Mostrar canceladas</Label>
      </div>

      {/* Edit Concluido Confirmation */}
      <Dialog open={!!editConfirmItem} onOpenChange={(open) => { if (!open) setEditConfirmItem(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Produção já concluída
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            A produção de <strong>{editConfirmItem?.brigadeiro_nome}</strong> já está concluída. Editar pode afetar os custos calculados. Deseja continuar?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditConfirmItem(null)}>Cancelar</Button>
            <Button onClick={confirmEditConcluido}>Editar mesmo assim</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editItem} onOpenChange={(open) => { if (!open) setEditItem(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-display">Editar Produção</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Data</Label>
              <Input type="date" value={editData.data} onChange={(e) => setEditData({ ...editData, data: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Quantidade</Label>
              <Input type="number" min="1" value={editData.quantidade} onChange={(e) => setEditData({ ...editData, quantidade: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={editData.status} onValueChange={(v) => setEditData({ ...editData, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planejado">Planejado</SelectItem>
                  <SelectItem value="em-andamento">Em Andamento</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleEdit} className="w-full" disabled={saving || !editData.quantidade || parseInt(editData.quantidade) <= 0}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Salvar Alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={!!cancelItem} onOpenChange={(open) => { if (!open) { setCancelItem(null); setCancelReason(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-display">Cancelar Produção</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Cancelar <strong>{cancelItem?.brigadeiro_nome}</strong> ({cancelItem?.quantidade} un.)?
            </p>
            <div className="space-y-2">
              <Label>Motivo (opcional)</Label>
              <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Ex: Ingredientes insuficientes" />
            </div>
            <Button variant="destructive" onClick={handleCancel} className="w-full" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirmar Cancelamento
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Production Timeline */}
      {sortedDates.length === 0 ? (
        <div className="text-center py-16">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <Cookie className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-display font-semibold text-lg text-foreground mb-1">Nenhuma produção planejada</h3>
          <p className="text-muted-foreground text-sm mb-4">Clique em "Planejar Produção" para adicionar sua primeira produção.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((dateKey) => (
            <div key={dateKey} className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="bg-muted/50 px-5 py-3 flex items-center gap-2 border-b border-border">
                <Calendar size={18} className="text-muted-foreground" />
                <h3 className="font-display font-semibold">
                  {format(new Date(dateKey), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </h3>
              </div>
              <div className="divide-y divide-border">
                {producaoByDate[dateKey].map((item) => {
                  const isDeleted = !!item.deleted_at;
                  return (
                    <div key={item.id} className={cn("p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4", isDeleted && "opacity-50")}>
                      <div className="flex-1">
                        <h4 className="font-medium">
                          {item.brigadeiro_nome}
                          {isDeleted && <span className="ml-2 text-xs text-destructive font-normal">(Cancelada)</span>}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {item.quantidade} unidades • Custo: R$ {item.custo_total.toFixed(2)}
                        </p>
                        {isDeleted && item.deleted_reason && (
                          <p className="text-xs text-muted-foreground mt-1">Motivo: {item.deleted_reason}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {!isDeleted && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => openEdit(item)} className="h-8 w-8">
                              <Pencil size={14} />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setCancelItem(item)} className="h-8 w-8 text-destructive hover:text-destructive">
                              <Trash2 size={14} />
                            </Button>
                            <Select
                              value={item.status}
                              onValueChange={(value: ProducaoDiaria['status']) => updateProducaoStatus(item.id, value)}
                            >
                              <SelectTrigger className={cn("w-full sm:w-[160px] text-sm font-medium border-0", statusLabels[item.status]?.class)}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="planejado">Planejado</SelectItem>
                                <SelectItem value="em-andamento">Em Andamento</SelectItem>
                                <SelectItem value="concluido">Concluído</SelectItem>
                              </SelectContent>
                            </Select>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
