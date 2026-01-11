import { useState } from 'react';
import { Plus, Pencil, Trash2, Search } from 'lucide-react';
import { brigadeiros as initialBrigadeiros } from '@/data/mockData';
import { Brigadeiro } from '@/types';
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
  const [brigadeiros, setBrigadeiros] = useState<Brigadeiro[]>(initialBrigadeiros);
  const [search, setSearch] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBrigadeiro, setEditingBrigadeiro] = useState<Brigadeiro | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    tipo: 'tradicional' as Brigadeiro['tipo'],
    precoVenda: '',
    custoUnitario: '',
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
        precoVenda: brigadeiro.precoVenda.toString(),
        custoUnitario: brigadeiro.custoUnitario.toString(),
        descricao: brigadeiro.descricao || '',
      });
    } else {
      setEditingBrigadeiro(null);
      setFormData({
        nome: '',
        tipo: 'tradicional',
        precoVenda: '',
        custoUnitario: '',
        descricao: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    const precoVenda = parseFloat(formData.precoVenda);
    const custoUnitario = parseFloat(formData.custoUnitario);
    const margemLucro = ((precoVenda - custoUnitario) / precoVenda) * 100;

    if (editingBrigadeiro) {
      setBrigadeiros(brigadeiros.map(b => 
        b.id === editingBrigadeiro.id 
          ? { ...b, ...formData, precoVenda, custoUnitario, margemLucro }
          : b
      ));
    } else {
      const newBrigadeiro: Brigadeiro = {
        id: Date.now().toString(),
        nome: formData.nome,
        tipo: formData.tipo,
        precoVenda,
        custoUnitario,
        margemLucro,
        descricao: formData.descricao,
        ativo: true,
      };
      setBrigadeiros([...brigadeiros, newBrigadeiro]);
    }
    setIsDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    setBrigadeiros(brigadeiros.filter(b => b.id !== id));
  };

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
                    value={formData.precoVenda}
                    onChange={(e) => setFormData({ ...formData, precoVenda: e.target.value })}
                    placeholder="5.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Custo Unitário (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.custoUnitario}
                    onChange={(e) => setFormData({ ...formData, custoUnitario: e.target.value })}
                    placeholder="1.80"
                  />
                </div>
              </div>
              {formData.precoVenda && formData.custoUnitario && (
                <div className="p-3 bg-success/10 rounded-lg">
                  <p className="text-sm text-success font-medium">
                    Margem de lucro: {(((parseFloat(formData.precoVenda) - parseFloat(formData.custoUnitario)) / parseFloat(formData.precoVenda)) * 100).toFixed(1)}%
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
              <Button onClick={handleSave} className="w-full">
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
                <p className="font-semibold text-success">R$ {brigadeiro.precoVenda.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Custo</p>
                <p className="font-medium">R$ {brigadeiro.custoUnitario.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Margem</p>
                <p className="font-medium text-accent">{brigadeiro.margemLucro.toFixed(1)}%</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
