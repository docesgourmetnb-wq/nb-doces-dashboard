import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Search, Loader2, Package, Scale, TrendingUp, AlertTriangle } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import {
  BRIGADEIRO_TAMANHO_FILTERS,
  BRIGADEIRO_TAMANHOS_COMERCIAIS,
  type BrigadeiroTamanhoFilter,
  filterProdutosBrigadeiro,
  getProdutoNomeBase,
  getProdutoTamanhoComercial,
  inferProdutoTamanhoGramas,
  isBrigadeiroTamanhoGramas,
  matchesBrigadeiroTamanhoFilter,
  summarizeProdutos,
} from '@/domain/produtos';
import { parseDecimalInput } from '@/domain/numeros';
import { formatCurrencyBRL } from '@/lib/utils';

type ProdutoFormErrors = Partial<Record<'nome' | 'tamanho_g' | 'preco_venda' | 'custo_unitario', string>>;
function getTamanhoSortValue(tamanho: string | null) {
  return Number(tamanho?.replace(',', '.').replace(/g$/i, '') ?? Number.POSITIVE_INFINITY);
}

export function ProdutosPage() {
  const { brigadeiros, loading, addBrigadeiro, updateBrigadeiro, deleteBrigadeiro } = useBrigadeiros();
  const [search, setSearch] = useState('');
  const [tamanhoFilter, setTamanhoFilter] = useState<BrigadeiroTamanhoFilter>('todos');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBrigadeiro, setEditingBrigadeiro] = useState<Brigadeiro | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    tamanho_g: '30',
    tipo: 'gourmet' as Brigadeiro['tipo'],
    preco_venda: '',
    custo_unitario: '',
    descricao: '',
  });
  const produtosBrigadeiro = useMemo(() => filterProdutosBrigadeiro(brigadeiros), [brigadeiros]);

  const filteredBrigadeiros = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    return produtosBrigadeiro
      .filter((brigadeiro) => {
        const matchesSearch = !searchTerm || brigadeiro.nome.toLowerCase().includes(searchTerm);
        const matchesTamanho = matchesBrigadeiroTamanhoFilter(brigadeiro, tamanhoFilter);
        return matchesSearch && matchesTamanho;
      })
      .sort((a, b) => {
        const nomeBaseCompare = getProdutoNomeBase(a.nome).localeCompare(getProdutoNomeBase(b.nome), 'pt-BR');
        if (nomeBaseCompare !== 0) return nomeBaseCompare;
        return getTamanhoSortValue(getProdutoTamanhoComercial(a)) - getTamanhoSortValue(getProdutoTamanhoComercial(b));
      });
  }, [produtosBrigadeiro, search, tamanhoFilter]);
  const produtosResumo = useMemo(() => summarizeProdutos(produtosBrigadeiro), [produtosBrigadeiro]);
  const primeiroSaborSemPar = produtosResumo.saboresSemPar[0];
  const saboresSemParPorNome = useMemo(() => {
    return new Map(produtosResumo.saboresSemPar.map((produto) => [produto.nomeBase, produto]));
  }, [produtosResumo.saboresSemPar]);

  const handleOpenDialog = (brigadeiro?: Brigadeiro) => {
    if (brigadeiro) {
      setEditingBrigadeiro(brigadeiro);
      setFormData({
        nome: brigadeiro.nome,
        tamanho_g: String(brigadeiro.tamanho_g ?? inferProdutoTamanhoGramas(brigadeiro.nome) ?? 30),
        tipo: brigadeiro.tipo,
        preco_venda: brigadeiro.preco_venda.toString(),
        custo_unitario: brigadeiro.custo_unitario.toString(),
        descricao: brigadeiro.descricao || '',
      });
    } else {
      setEditingBrigadeiro(null);
      setFormData({
        nome: '',
        tamanho_g: '30',
        tipo: 'gourmet',
        preco_venda: '',
        custo_unitario: '',
        descricao: '',
      });
    }
    setIsDialogOpen(true);
  };

  const [formErrors, setFormErrors] = useState<ProdutoFormErrors>({});
  const precoVendaNumber = parseDecimalInput(formData.preco_venda);
  const custoUnitarioNumber = parseDecimalInput(formData.custo_unitario);
  const canShowMargin =
    Number.isFinite(precoVendaNumber) &&
    Number.isFinite(custoUnitarioNumber) &&
    precoVendaNumber > 0 &&
    custoUnitarioNumber >= 0;

  const handleSave = async () => {
    const errors: ProdutoFormErrors = {};
    const preco_venda = parseDecimalInput(formData.preco_venda);
    const custo_unitario = parseDecimalInput(formData.custo_unitario);
    const tamanho_g = Number(formData.tamanho_g);

    if (!formData.nome.trim()) {
      errors.nome = 'Informe o nome do produto';
    }
    if (!isBrigadeiroTamanhoGramas(tamanho_g)) {
      errors.tamanho_g = 'Selecione 25g ou 30g';
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
    try {
      if (editingBrigadeiro) {
        await updateBrigadeiro(editingBrigadeiro.id, {
          nome: formData.nome.trim(),
          categoria: 'brigadeiro',
          tamanho_g,
          tipo: formData.tipo,
          preco_venda,
          custo_unitario,
          descricao: formData.descricao.trim() || null,
        });
      } else {
        await addBrigadeiro({
          nome: formData.nome.trim(),
          categoria: 'brigadeiro',
          tamanho_g,
          tipo: formData.tipo,
          preco_venda,
          custo_unitario,
          descricao: formData.descricao.trim() || null,
          ativo: true,
        });
      }
      setIsDialogOpen(false);
    } finally {
      setSaving(false);
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
              <div className="space-y-2">
                <Label htmlFor="produto-tamanho">Tamanho</Label>
                <select
                  id="produto-tamanho"
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  value={formData.tamanho_g}
                  onChange={(e) => {
                    setFormData({ ...formData, tamanho_g: e.target.value });
                    if (formErrors.tamanho_g) setFormErrors({ ...formErrors, tamanho_g: '' });
                  }}
                  aria-invalid={!!formErrors.tamanho_g}
                  aria-describedby={formErrors.tamanho_g ? 'produto-tamanho-error' : undefined}
                >
                  {BRIGADEIRO_TAMANHOS_COMERCIAIS.map((tamanho) => (
                    <option key={tamanho} value={tamanho.replace('g', '')}>{tamanho}</option>
                  ))}
                </select>
                {formErrors.tamanho_g && <p id="produto-tamanho-error" className="text-xs text-destructive">{formErrors.tamanho_g}</p>}
                <p className="text-xs text-muted-foreground">Não precisa colocar o tamanho no nome.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="produto-preco-venda">Preço de Venda (R$)</Label>
                  <Input
                    id="produto-preco-venda"
                    type="text"
                    inputMode="decimal"
                    value={formData.preco_venda}
                    onChange={(e) => {
                      setFormData({ ...formData, preco_venda: e.target.value });
                      if (formErrors.preco_venda) setFormErrors({ ...formErrors, preco_venda: '' });
                    }}
                    placeholder="Ex: 3,50"
                    aria-invalid={!!formErrors.preco_venda}
                    aria-describedby={formErrors.preco_venda ? 'produto-preco-venda-error' : undefined}
                  />
                  {formErrors.preco_venda && <p id="produto-preco-venda-error" className="text-xs text-destructive">{formErrors.preco_venda}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="produto-custo-unitario">Custo Unitário (R$)</Label>
                  <Input
                    id="produto-custo-unitario"
                    type="text"
                    inputMode="decimal"
                    value={formData.custo_unitario}
                    onChange={(e) => {
                      setFormData({ ...formData, custo_unitario: e.target.value });
                      if (formErrors.custo_unitario) setFormErrors({ ...formErrors, custo_unitario: '' });
                    }}
                    placeholder="Ex: 0,93"
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

      <section aria-labelledby="produtos-lista-heading" className="space-y-4">
        <h2 id="produtos-lista-heading" className="sr-only">Lista de produtos</h2>

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
            {BRIGADEIRO_TAMANHO_FILTERS.map((filter) => (
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
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {filteredBrigadeiros.map((brigadeiro) => {
              const tamanho = getProdutoTamanhoComercial(brigadeiro);
              const nomeBase = getProdutoNomeBase(brigadeiro.nome);
              const produtoSemPar = saboresSemParPorNome.get(nomeBase);

            return (
              <div
                key={brigadeiro.id}
                className="bg-card border border-border rounded-lg p-4 card-hover shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {tamanho ? (
                      <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                        {tamanho}
                      </span>
                    ) : null}
                    <h3 className="mt-3 line-clamp-2 min-h-[3rem] font-display text-lg font-semibold leading-tight">
                      {nomeBase}
                    </h3>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => handleOpenDialog(brigadeiro)}
                      className="rounded-md p-1.5 transition-colors hover:bg-muted"
                      aria-label={`Editar ${brigadeiro.nome}`}
                    >
                      <Pencil size={16} className="text-muted-foreground" />
                    </button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          className="rounded-md p-1.5 transition-colors hover:bg-destructive/10"
                          aria-label={`Excluir ${brigadeiro.nome}`}
                        >
                          <Trash2 size={16} className="text-destructive" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remover produto?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Tem certeza que deseja remover {brigadeiro.nome}? Esta ação não pode ser desfeita.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteBrigadeiro(brigadeiro.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remover
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                {produtoSemPar && (
                  <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-warning/20 bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                    <AlertTriangle size={13} aria-hidden="true" />
                    Sem {produtoSemPar.faltando.join('/')}
                  </div>
                )}
                {brigadeiro.descricao && (
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{brigadeiro.descricao}</p>
                )}
              
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Venda</p>
                    <p className="text-sm font-semibold text-success">{formatCurrencyBRL(brigadeiro.preco_venda)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Custo</p>
                    <p className="text-sm font-medium">{formatCurrencyBRL(brigadeiro.custo_unitario)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Margem</p>
                    <p className="text-sm font-medium text-accent">{brigadeiro.margem_lucro?.toFixed(1) || 0}%</p>
                  </div>
                </div>
              </div>
            );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
