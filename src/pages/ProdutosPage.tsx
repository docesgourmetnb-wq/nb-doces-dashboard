import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Search, Loader2, Package, Scale, TrendingUp } from 'lucide-react';
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
import { getProdutoNomeBase, getProdutoTamanho, summarizeProdutos } from '@/domain/produtos';
import { formatCurrencyBRL } from '@/lib/utils';

type ProdutoFormErrors = Partial<Record<'nome' | 'preco_venda' | 'custo_unitario', string>>;
type TamanhoFilter = 'todos' | '25g' | '30g';

const tamanhoFilters: Array<{ value: TamanhoFilter; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: '25g', label: '25g' },
  { value: '30g', label: '30g' },
];

function getTamanhoSortValue(tamanho: string | null) {
  return Number(tamanho?.replace(',', '.').replace(/g$/i, '') ?? Number.POSITIVE_INFINITY);
}

export function ProdutosPage() {
  const { brigadeiros, loading, addBrigadeiro, updateBrigadeiro, deleteBrigadeiro } = useBrigadeiros();
  const [search, setSearch] = useState('');
  const [tamanhoFilter, setTamanhoFilter] = useState<TamanhoFilter>('todos');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBrigadeiro, setEditingBrigadeiro] = useState<Brigadeiro | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    tipo: 'gourmet' as Brigadeiro['tipo'],
    preco_venda: '',
    custo_unitario: '',
    descricao: '',
  });

  const filteredBrigadeiros = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    return brigadeiros
      .filter((brigadeiro) => {
        const tamanho = getProdutoTamanho(brigadeiro.nome);
        const matchesSearch = !searchTerm || brigadeiro.nome.toLowerCase().includes(searchTerm);
        const matchesTamanho = tamanhoFilter === 'todos' || tamanho === tamanhoFilter;
        return matchesSearch && matchesTamanho;
      })
      .sort((a, b) => {
        const nomeBaseCompare = getProdutoNomeBase(a.nome).localeCompare(getProdutoNomeBase(b.nome), 'pt-BR');
        if (nomeBaseCompare !== 0) return nomeBaseCompare;
        return getTamanhoSortValue(getProdutoTamanho(a.nome)) - getTamanhoSortValue(getProdutoTamanho(b.nome));
      });
  }, [brigadeiros, search, tamanhoFilter]);
  const produtosResumo = useMemo(() => summarizeProdutos(brigadeiros), [brigadeiros]);
  const primeiroSaborSemPar = produtosResumo.saboresSemPar[0];

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
        tipo: 'gourmet',
        preco_venda: '',
        custo_unitario: '',
        descricao: '',
      });
    }
    setIsDialogOpen(true);
  };

  const [formErrors, setFormErrors] = useState<ProdutoFormErrors>({});
  const precoVendaNumber = Number(formData.preco_venda);
  const custoUnitarioNumber = Number(formData.custo_unitario);
  const canShowMargin =
    Number.isFinite(precoVendaNumber) &&
    Number.isFinite(custoUnitarioNumber) &&
    precoVendaNumber > 0 &&
    custoUnitarioNumber >= 0;

  const handleSave = async () => {
    const errors: ProdutoFormErrors = {};
    const preco_venda = Number(formData.preco_venda);
    const custo_unitario = Number(formData.custo_unitario);

    if (!formData.nome.trim()) {
      errors.nome = 'Informe o nome do produto';
    }
    if (!Number.isFinite(preco_venda) || preco_venda <= 0) {
      errors.preco_venda = 'Preço de venda deve ser maior que zero';
    }
    if (!Number.isFinite(custo_unitario) || custo_unitario < 0) {
      errors.custo_unitario = 'Custo unitário não pode ser negativo';
    }
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);

    if (editingBrigadeiro) {
      await updateBrigadeiro(editingBrigadeiro.id, {
        nome: formData.nome.trim(),
        tipo: formData.tipo,
        preco_venda,
        custo_unitario,
        descricao: formData.descricao.trim() || null,
      });
    } else {
      await addBrigadeiro({
        nome: formData.nome.trim(),
        tipo: formData.tipo,
        preco_venda,
        custo_unitario,
        descricao: formData.descricao.trim() || null,
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
                <Label htmlFor="produto-nome">Nome</Label>
                <Input
                  id="produto-nome"
                  value={formData.nome}
                  onChange={(e) => {
                    setFormData({ ...formData, nome: e.target.value });
                    if (formErrors.nome) setFormErrors({ ...formErrors, nome: '' });
                  }}
                  placeholder="Ex: Brigadeiro de Nutella"
                  aria-invalid={!!formErrors.nome}
                  aria-describedby={formErrors.nome ? 'produto-nome-error' : undefined}
                />
                {formErrors.nome && <p id="produto-nome-error" className="text-xs text-destructive">{formErrors.nome}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="produto-preco-venda">Preço de Venda (R$)</Label>
                  <Input
                    id="produto-preco-venda"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.preco_venda}
                    onChange={(e) => {
                      setFormData({ ...formData, preco_venda: e.target.value });
                      if (formErrors.preco_venda) setFormErrors({ ...formErrors, preco_venda: '' });
                    }}
                    placeholder="5.00"
                    aria-invalid={!!formErrors.preco_venda}
                    aria-describedby={formErrors.preco_venda ? 'produto-preco-venda-error' : undefined}
                  />
                  {formErrors.preco_venda && <p id="produto-preco-venda-error" className="text-xs text-destructive">{formErrors.preco_venda}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="produto-custo-unitario">Custo Unitário (R$)</Label>
                  <Input
                    id="produto-custo-unitario"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.custo_unitario}
                    onChange={(e) => {
                      setFormData({ ...formData, custo_unitario: e.target.value });
                      if (formErrors.custo_unitario) setFormErrors({ ...formErrors, custo_unitario: '' });
                    }}
                    placeholder="1.80"
                    aria-invalid={!!formErrors.custo_unitario}
                    aria-describedby={formErrors.custo_unitario ? 'produto-custo-unitario-error' : undefined}
                  />
                  {formErrors.custo_unitario && <p id="produto-custo-unitario-error" className="text-xs text-destructive">{formErrors.custo_unitario}</p>}
                </div>
              </div>
              {canShowMargin && (
                <div className="p-3 bg-success/10 rounded-lg">
                  <p className="text-sm text-success font-medium">
                    Margem de lucro: {(((precoVendaNumber - custoUnitarioNumber) / precoVendaNumber) * 100).toFixed(1)}%
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="produto-descricao">Descrição (opcional)</Label>
                <Input
                  id="produto-descricao"
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase text-muted-foreground">Produtos ativos</p>
              <p className="mt-2 font-display text-3xl font-semibold text-foreground">{produtosResumo.total}</p>
              <p className="text-sm text-muted-foreground">Brigadeiros cadastrados</p>
            </div>
            <div className="rounded-xl bg-primary/10 p-3 text-primary">
              <Package size={22} aria-hidden="true" />
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase text-muted-foreground">Tamanhos</p>
              <p className="mt-2 font-display text-3xl font-semibold text-foreground">
                {produtosResumo.total25g} / {produtosResumo.total30g}
              </p>
              <p className="text-sm text-muted-foreground">25g / 30g</p>
              {produtosResumo.semTamanho > 0 && (
                <p className="mt-1 text-xs text-warning">{produtosResumo.semTamanho} sem tamanho definido</p>
              )}
              {primeiroSaborSemPar && (
                <p className="mt-1 text-xs text-warning">
                  {produtosResumo.saboresSemPar.length} sabor(es) sem par. Ex: {primeiroSaborSemPar.nomeBase} sem {primeiroSaborSemPar.faltando.join('/')}
                </p>
              )}
            </div>
            <div className="rounded-xl bg-accent/20 p-3 text-accent">
              <Scale size={22} aria-hidden="true" />
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase text-muted-foreground">Margem média</p>
              <p className="mt-2 font-display text-3xl font-semibold text-foreground">
                {produtosResumo.margemMedia.toFixed(1)}%
              </p>
              <p className="text-sm text-muted-foreground">Com base no preço e custo</p>
            </div>
            <div className="rounded-xl bg-success/10 p-3 text-success">
              <TrendingUp size={22} aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>

      {/* Search and filters */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative w-full max-w-md">
          <Label htmlFor="produto-busca" className="sr-only">Buscar brigadeiros</Label>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <Input
            id="produto-busca"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar brigadeiros..."
            className="pl-10"
          />
        </div>
        <div className="flex w-full sm:w-auto rounded-lg border border-border bg-muted/40 p-1">
          {tamanhoFilters.map((filter) => (
            <Button
              key={filter.value}
              type="button"
              size="sm"
              variant={tamanhoFilter === filter.value ? 'default' : 'ghost'}
              className="flex-1 sm:flex-none px-4"
              onClick={() => setTamanhoFilter(filter.value)}
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      {filteredBrigadeiros.length === 0 ? (
        <div className="text-center py-16">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <Search className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="font-display font-semibold text-lg text-foreground mb-1">Nenhum produto encontrado</h3>
          <p className="text-muted-foreground text-sm mb-4">
            {search ? 'Tente ajustar a busca.' : 'Clique em "Novo Brigadeiro" para adicionar seu primeiro produto.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBrigadeiros.map((brigadeiro) => {
            const tamanho = getProdutoTamanho(brigadeiro.nome);
            const nomeBase = getProdutoNomeBase(brigadeiro.nome);

            return (
              <div
                key={brigadeiro.id}
                className="bg-card border border-border rounded-xl p-5 card-hover shadow-sm"
              >
                <div className="flex items-start justify-between mb-3">
                  {tamanho ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                      {tamanho}
                    </span>
                  ) : (
                    <span aria-hidden="true" />
                  )}
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleOpenDialog(brigadeiro)}
                      className="p-2 hover:bg-muted rounded-lg transition-colors"
                      aria-label={`Editar ${brigadeiro.nome}`}
                    >
                      <Pencil size={16} className="text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => handleDelete(brigadeiro.id)}
                      className="p-2 hover:bg-destructive/10 rounded-lg transition-colors"
                      aria-label={`Excluir ${brigadeiro.nome}`}
                    >
                      <Trash2 size={16} className="text-destructive" />
                    </button>
                  </div>
                </div>
              
                <h3 className="font-display font-semibold text-lg mb-1">{nomeBase}</h3>
                {brigadeiro.descricao && (
                  <p className="text-sm text-muted-foreground mb-4">{brigadeiro.descricao}</p>
                )}
              
                <div className="grid grid-cols-3 gap-2 pt-4 border-t border-border">
                  <div>
                    <p className="text-xs text-muted-foreground">Venda</p>
                    <p className="font-semibold text-success">{formatCurrencyBRL(brigadeiro.preco_venda)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Custo</p>
                    <p className="font-medium">{formatCurrencyBRL(brigadeiro.custo_unitario)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Margem</p>
                    <p className="font-medium text-accent">{brigadeiro.margem_lucro?.toFixed(1) || 0}%</p>
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
