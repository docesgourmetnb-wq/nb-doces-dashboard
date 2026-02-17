import { useState } from 'react';
import { Plus, AlertTriangle, Package, Loader2 } from 'lucide-react';
import { useInsumos, Insumo } from '@/hooks/useInsumos';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

export function EstoquePage() {
  const { insumos, loading, addInsumo, updateInsumo, deleteInsumo } = useInsumos();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingInsumo, setEditingInsumo] = useState<Insumo | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    unidade: '',
    quantidade_atual: '',
    quantidade_minima: '',
    consumo_medio: '',
    preco_unitario: '',
  });

  const insumosEmFalta = insumos.filter(i => i.quantidade_atual <= i.quantidade_minima);
  const valorTotalEstoque = insumos.reduce((acc, i) => acc + (i.quantidade_atual * i.preco_unitario), 0);

  const handleOpenDialog = (insumo?: Insumo) => {
    if (insumo) {
      setEditingInsumo(insumo);
      setFormData({
        nome: insumo.nome,
        unidade: insumo.unidade,
        quantidade_atual: insumo.quantidade_atual.toString(),
        quantidade_minima: insumo.quantidade_minima.toString(),
        consumo_medio: insumo.consumo_medio.toString(),
        preco_unitario: insumo.preco_unitario.toString(),
      });
    } else {
      setEditingInsumo(null);
      setFormData({
        nome: '',
        unidade: '',
        quantidade_atual: '',
        quantidade_minima: '',
        consumo_medio: '',
        preco_unitario: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    
    if (editingInsumo) {
      await updateInsumo(editingInsumo.id, {
        nome: formData.nome,
        unidade: formData.unidade,
        quantidade_atual: parseFloat(formData.quantidade_atual),
        quantidade_minima: parseFloat(formData.quantidade_minima),
        consumo_medio: parseFloat(formData.consumo_medio),
        preco_unitario: parseFloat(formData.preco_unitario),
      });
    } else {
      await addInsumo({
        nome: formData.nome,
        unidade: formData.unidade,
        quantidade_atual: parseFloat(formData.quantidade_atual),
        quantidade_minima: parseFloat(formData.quantidade_minima),
        consumo_medio: parseFloat(formData.consumo_medio),
        preco_unitario: parseFloat(formData.preco_unitario),
      });
    }
    
    setSaving(false);
    setIsDialogOpen(false);
  };

  const getStockStatus = (insumo: Insumo) => {
    const ratio = insumo.quantidade_atual / insumo.quantidade_minima;
    if (ratio < 0.5) return { status: 'critical', color: 'bg-destructive' };
    if (ratio <= 1) return { status: 'low', color: 'bg-warning' };
    return { status: 'ok', color: 'bg-success' };
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
          <h1 className="font-display text-3xl font-semibold text-foreground">Estoque</h1>
          <p className="text-muted-foreground mt-1">Controle de insumos e materiais</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} className="gap-2">
              <Plus size={18} />
              Novo Insumo
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">
                {editingInsumo ? 'Editar Insumo' : 'Novo Insumo'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    placeholder="Ex: Leite Condensado"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unidade</Label>
                  <Input
                    value={formData.unidade}
                    onChange={(e) => setFormData({ ...formData, unidade: e.target.value })}
                    placeholder="Ex: lata, kg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantidade Atual</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.quantidade_atual}
                    onChange={(e) => setFormData({ ...formData, quantidade_atual: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quantidade Mínima</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.quantidade_minima}
                    onChange={(e) => setFormData({ ...formData, quantidade_minima: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Consumo Médio/Sem.</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.consumo_medio}
                    onChange={(e) => setFormData({ ...formData, consumo_medio: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Preço Unitário (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.preco_unitario}
                    onChange={(e) => setFormData({ ...formData, preco_unitario: e.target.value })}
                  />
                </div>
              </div>
              <Button onClick={handleSave} className="w-full" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editingInsumo ? 'Salvar Alterações' : 'Adicionar Insumo'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Package className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total de Itens</p>
              <p className="text-2xl font-display font-semibold">{insumos.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-warning/20 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Itens em Falta</p>
              <p className="text-2xl font-display font-semibold">{insumosEmFalta.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Valor do Estoque</p>
          <p className="text-2xl font-display font-semibold mt-1">
            R$ {valorTotalEstoque.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Inventory List */}
      {insumos.length === 0 ? (
        <div className="text-center py-16">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <Package className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-display font-semibold text-lg text-foreground mb-1">Nenhum insumo cadastrado</h3>
          <p className="text-muted-foreground text-sm mb-4">Clique em "Novo Insumo" para adicionar seu primeiro item.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {insumos.map((insumo) => {
            const stockStatus = getStockStatus(insumo);
            const progressValue = Math.min((insumo.quantidade_atual / insumo.quantidade_minima) * 100, 100);
            
            return (
              <div
                key={insumo.id}
                onClick={() => handleOpenDialog(insumo)}
                className="bg-card border border-border rounded-xl p-5 card-hover shadow-sm cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-display font-semibold">{insumo.nome}</h3>
                  {stockStatus.status !== 'ok' && (
                    <span className={cn(
                      "px-2 py-1 rounded-full text-xs font-medium",
                      stockStatus.status === 'critical' 
                        ? 'bg-destructive/20 text-destructive' 
                        : 'bg-warning/20 text-warning'
                    )}>
                      {stockStatus.status === 'critical' ? 'Crítico' : 'Baixo'}
                    </span>
                  )}
                </div>
                
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Estoque atual</span>
                    <span className="font-medium">
                      {insumo.quantidade_atual} / {insumo.quantidade_minima} {insumo.unidade}
                    </span>
                  </div>
                  <Progress value={progressValue} className="h-2" />
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm pt-3 border-t border-border">
                  <div>
                    <p className="text-muted-foreground">Consumo/Sem.</p>
                    <p className="font-medium">{insumo.consumo_medio} {insumo.unidade}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Valor Unit.</p>
                    <p className="font-medium">R$ {insumo.preco_unitario.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
