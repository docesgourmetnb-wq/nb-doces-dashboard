import { useState } from 'react';
import { Plus, Pencil, Trash2, Search, Loader2 } from 'lucide-react';
import { useBrigadeiros, Brigadeiro } from '@/hooks/useBrigadeiros';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export function ProdutosPage() {
  const { brigadeiros, loading, addBrigadeiro, updateBrigadeiro, deleteBrigadeiro } = useBrigadeiros();
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBrigadeiro, setEditingBrigadeiro] = useState<Brigadeiro | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    tipo: 'tradicional' as Brigadeiro['tipo'],
    preco_venda: '',
    custo_unitario: '',
    descricao: '',
  });

  const filteredBrigadeiros = brigadeiros.filter((b) =>
    b.nome.toLowerCase().includes(search.toLowerCase())
  );

  const tipoLabels = {
    tradicional: { label: 'Tradicional', class: 'bg-primary/10 text-primary' },
    gourmet: { label: 'Gourmet', class: 'bg-accent/20 text-accent-foreground' },
    premium: { label: 'Premium', class: 'bg-warning/20 text-warning' },
  };

  const handleOpenDialog = (brigadeiro?: Brigadeiro) => {
    if (brigadeiro) {
      setEditingBrigadeiro(brigadeiro);
      setFormData({
        nome: brigadeiro.nome,
        tipo: brigadeiro.tipo,
        preco_venda: brigadeiro.preco_venda.toString(),
        custo_unitario: brigadeiro.custo_unitario.toString(),
        descricao: brigadeiro.descricao || '',
      });
    } else {
      setEditingBrigadeiro(null);
      setFormData({
        nome: '',
        tipo: 'tradicional',
        preco_venda: '',
        custo_unitario: '',
        descricao: '',
      });
    }
    setIsDialogOpen(true);
  };

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const handleSave = async () => {
    const errors: Record<string, string> = {};
    const preco_venda = parseFloat(formData.preco_venda);
    const custo_unitario = parseFloat(formData.custo_unitario);

    if (isNaN(preco_venda) || preco_venda < 0) {
      errors.preco_venda = 'Preço de venda não pode ser negativo';
    }
    if (isNaN(custo_unitario) || custo_unitario < 0) {
      errors.custo_unitario = 'Custo unitário não pode ser negativo';
    }
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);

    if (editingBrigadeiro) {
      await updateBrigadeiro(editingBrigadeiro.id, {
        nome: formData.nome,
        tipo: formData.tipo,
        preco_venda,
        custo_unitario,
        descricao: formData.descricao || null,
      });
    } else {
      await addBrigadeiro({
        nome: formData.nome,
        tipo: formData.tipo,
        preco_venda,
        custo_unitario,
        descricao: formData.descricao || null,
        ativo: true,
      });
    }
    setSaving(false);
    setIsDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja remover este produto?')) {
      await deleteBrigadeiro(id);
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
          <h1 className="font-display text-3xl font-semibold text-foreground">Produtos</h1>
          <p className="text-muted-foreground mt-1">Gerencie seus brigadeiros</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} className="gap-2">
              <Plus size={18} />
              Novo Brigadeiro
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">
                {editingBrigadeiro ? 'Editar Brigadeiro' : 'Novo Brigadeiro'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: Brigadeiro de Nutella"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(value: Brigadeiro['tipo']) => setFormData({ ...formData, tipo: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tradicional">Tradicional</SelectItem>
                    <SelectItem value="gourmet">Gourmet</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Preço de Venda (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.preco_venda}
                    onChange={(e) => setFormData({ ...formData, preco_venda: e.target.value })}
                    placeholder="5.00"
                  />
                  {formErrors.preco_venda && <p className="text-xs text-destructive">{formErrors.preco_venda}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Custo Unitário (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.custo_unitario}
                    onChange={(e) => setFormData({ ...formData, custo_unitario: e.target.value })}
                    placeholder="1.80"
                  />
                  {formErrors.custo_unitario && <p className="text-xs text-destructive">{formErrors.custo_unitario}</p>}
                </div>
              </div>
              {formData.preco_venda && formData.custo_unitario && (
                <div className="p-3 bg-success/10 rounded-lg">
                  <p className="text-sm text-success font-medium">
                    Margem de lucro: {(((parseFloat(formData.preco_venda) - parseFloat(formData.custo_unitario)) / parseFloat(formData.preco_venda)) * 100).toFixed(1)}%
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label>Descrição (opcional)</Label>
                <Input
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  placeholder="Breve descrição do produto"
                />
              </div>
              <Button onClick={handleSave} className="w-full" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editingBrigadeiro ? 'Salvar Alterações' : 'Adicionar Produto'}
              </Button>
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
          placeholder="Buscar brigadeiros..."
          className="pl-10"
        />
      </div>

      {/* Products Grid */}
      {filteredBrigadeiros.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>Nenhum produto cadastrado ainda.</p>
          <p className="text-sm">Clique em "Novo Brigadeiro" para adicionar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBrigadeiros.map((brigadeiro) => (
            <div
              key={brigadeiro.id}
              className="bg-card border border-border rounded-xl p-5 card-hover shadow-sm"
            >
              <div className="flex items-start justify-between mb-3">
                <span className={cn(
                  "px-2 py-1 rounded-full text-xs font-medium",
                  tipoLabels[brigadeiro.tipo].class
                )}>
                  {tipoLabels[brigadeiro.tipo].label}
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleOpenDialog(brigadeiro)}
                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                  >
                    <Pencil size={16} className="text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => handleDelete(brigadeiro.id)}
                    className="p-2 hover:bg-destructive/10 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} className="text-destructive" />
                  </button>
                </div>
              </div>
              
              <h3 className="font-display font-semibold text-lg mb-1">{brigadeiro.nome}</h3>
              {brigadeiro.descricao && (
                <p className="text-sm text-muted-foreground mb-4">{brigadeiro.descricao}</p>
              )}
              
              <div className="grid grid-cols-3 gap-2 pt-4 border-t border-border">
                <div>
                  <p className="text-xs text-muted-foreground">Venda</p>
                  <p className="font-semibold text-success">R$ {brigadeiro.preco_venda.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Custo</p>
                  <p className="font-medium">R$ {brigadeiro.custo_unitario.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Margem</p>
                  <p className="font-medium text-accent">{brigadeiro.margem_lucro?.toFixed(1) || 0}%</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
