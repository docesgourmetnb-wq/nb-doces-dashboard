import { useState } from 'react';
import { Plus, AlertTriangle, Package } from 'lucide-react';
import { insumos as initialInsumos } from '@/data/mockData';
import { Insumo } from '@/types';
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
  const [insumos, setInsumos] = useState<Insumo[]>(initialInsumos);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingInsumo, setEditingInsumo] = useState<Insumo | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    unidade: '',
    quantidadeAtual: '',
    quantidadeMinima: '',
    consumoMedio: '',
    precoUnitario: '',
  });

  const insumosEmFalta = insumos.filter(i => i.quantidadeAtual <= i.quantidadeMinima);
  const valorTotalEstoque = insumos.reduce((acc, i) => acc + (i.quantidadeAtual * i.precoUnitario), 0);

  const handleOpenDialog = (insumo?: Insumo) => {
    if (insumo) {
      setEditingInsumo(insumo);
      setFormData({
        nome: insumo.nome,
        unidade: insumo.unidade,
        quantidadeAtual: insumo.quantidadeAtual.toString(),
        quantidadeMinima: insumo.quantidadeMinima.toString(),
        consumoMedio: insumo.consumoMedio.toString(),
        precoUnitario: insumo.precoUnitario.toString(),
      });
    } else {
      setEditingInsumo(null);
      setFormData({
        nome: '',
        unidade: '',
        quantidadeAtual: '',
        quantidadeMinima: '',
        consumoMedio: '',
        precoUnitario: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (editingInsumo) {
      setInsumos(insumos.map(i => 
        i.id === editingInsumo.id 
          ? { 
              ...i, 
              ...formData,
              quantidadeAtual: parseFloat(formData.quantidadeAtual),
              quantidadeMinima: parseFloat(formData.quantidadeMinima),
              consumoMedio: parseFloat(formData.consumoMedio),
              precoUnitario: parseFloat(formData.precoUnitario),
            }
          : i
      ));
    } else {
      const novoInsumo: Insumo = {
        id: Date.now().toString(),
        nome: formData.nome,
        unidade: formData.unidade,
        quantidadeAtual: parseFloat(formData.quantidadeAtual),
        quantidadeMinima: parseFloat(formData.quantidadeMinima),
        consumoMedio: parseFloat(formData.consumoMedio),
        precoUnitario: parseFloat(formData.precoUnitario),
      };
      setInsumos([...insumos, novoInsumo]);
    }
    setIsDialogOpen(false);
  };

  const getStockStatus = (insumo: Insumo) => {
    const ratio = insumo.quantidadeAtual / insumo.quantidadeMinima;
    if (ratio < 0.5) return { status: 'critical', color: 'bg-destructive' };
    if (ratio <= 1) return { status: 'low', color: 'bg-warning' };
    return { status: 'ok', color: 'bg-success' };
  };

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
                    value={formData.quantidadeAtual}
                    onChange={(e) => setFormData({ ...formData, quantidadeAtual: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quantidade Mínima</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.quantidadeMinima}
                    onChange={(e) => setFormData({ ...formData, quantidadeMinima: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Consumo Médio/Sem.</Label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.consumoMedio}
                    onChange={(e) => setFormData({ ...formData, consumoMedio: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Preço Unitário (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.precoUnitario}
                    onChange={(e) => setFormData({ ...formData, precoUnitario: e.target.value })}
                  />
                </div>
              </div>
              <Button onClick={handleSave} className="w-full">
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {insumos.map((insumo) => {
          const stockStatus = getStockStatus(insumo);
          const progressValue = Math.min((insumo.quantidadeAtual / insumo.quantidadeMinima) * 100, 100);
          
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
                    {insumo.quantidadeAtual} / {insumo.quantidadeMinima} {insumo.unidade}
                  </span>
                </div>
                <Progress value={progressValue} className="h-2" />
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm pt-3 border-t border-border">
                <div>
                  <p className="text-muted-foreground">Consumo/Sem.</p>
                  <p className="font-medium">{insumo.consumoMedio} {insumo.unidade}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Valor Unit.</p>
                  <p className="font-medium">R$ {insumo.precoUnitario.toFixed(2)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
