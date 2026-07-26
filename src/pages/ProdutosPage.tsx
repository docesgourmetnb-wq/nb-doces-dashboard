import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Search, Loader2, Package, Scale, TrendingUp, AlertTriangle, CakeSlice } from 'lucide-react';
import { useBrigadeiros, Brigadeiro } from '@/hooks/useBrigadeiros';
import { type ProdutoCatalogo, type ProdutoCatalogoVariacao, useProdutosCatalogo } from '@/hooks/useProdutosCatalogo';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BRIGADEIRO_TAMANHO_FILTERS,
  BRIGADEIRO_TAMANHOS_COMERCIAIS,
  type BrigadeiroTamanhoFilter,
  filterProdutosBrigadeiro,
  getProdutoNomeComercial,
  getProdutoTamanhoComercial,
  inferProdutoTamanhoGramas,
  isBrigadeiroTamanhoGramas,
  matchesBrigadeiroTamanhoFilter,
  summarizeProdutos,
  type ProdutoCategoria,
} from '@/domain/produtos';
import { parseDecimalInput } from '@/domain/numeros';
import { formatCurrencyBRL } from '@/lib/utils';

type ProdutoFormErrors = Partial<Record<'nome' | 'tamanho_g' | 'preco_venda' | 'custo_unitario', string>>;
type BoloFormErrors = Partial<Record<'nome' | 'variacao' | 'preco_venda' | 'custo_calculado', string>>;
function getTamanhoSortValue(tamanho: string | null) {
  return Number(tamanho?.replace(',', '.').replace(/g$/i, '') ?? Number.POSITIVE_INFINITY);
}

export function ProdutosPage() {
  const { brigadeiros, loading, addBrigadeiro, updateBrigadeiro, deleteBrigadeiro } = useBrigadeiros();
  const {
    produtos: produtosCatalogo,
    resumo: catalogoResumo,
    loading: loadingCatalogo,
    addProdutoComVariacao,
    addVariacaoProduto,
    updateVariacaoProduto,
    deleteVariacaoProduto,
    deleteProduto,
  } = useProdutosCatalogo();
  const [search, setSearch] = useState('');
  const [boloSearch, setBoloSearch] = useState('');
  const [tamanhoFilter, setTamanhoFilter] = useState<BrigadeiroTamanhoFilter>('todos');
  const [categoriaView, setCategoriaView] = useState<ProdutoCategoria>('brigadeiro');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isBoloDialogOpen, setIsBoloDialogOpen] = useState(false);
  const [isVariacaoDialogOpen, setIsVariacaoDialogOpen] = useState(false);
  const [editingBrigadeiro, setEditingBrigadeiro] = useState<Brigadeiro | null>(null);
  const [selectedBoloForVariation, setSelectedBoloForVariation] = useState<ProdutoCatalogo | null>(null);
  const [editingBoloVariation, setEditingBoloVariation] = useState<ProdutoCatalogoVariacao | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingBolo, setSavingBolo] = useState(false);
  const [savingVariacao, setSavingVariacao] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    tamanho_g: '30',
    tipo: 'gourmet' as Brigadeiro['tipo'],
    preco_venda: '',
    custo_unitario: '',
    descricao: '',
  });
  const [boloFormData, setBoloFormData] = useState({
    nome: '',
    variacao: '',
    tamanho: '',
    cobertura: '',
    preco_venda: '',
    custo_calculado: '',
    validade_dias: '',
    prazo_minimo_dias: '',
    modelo_producao: 'sob_encomenda',
  });
  const [variacaoFormData, setVariacaoFormData] = useState({
    variacao: '',
    tamanho: '',
    cobertura: '',
    preco_venda: '',
    custo_calculado: '',
    validade_dias: '',
    prazo_minimo_dias: '',
    modelo_producao: 'sob_encomenda',
  });
  const produtosBrigadeiro = useMemo(() => filterProdutosBrigadeiro(brigadeiros), [brigadeiros]);
  const bolosCatalogo = useMemo(() => {
    return produtosCatalogo.filter((produto) => produto.categoria_codigo === 'bolo');
  }, [produtosCatalogo]);
  const filteredBolosCatalogo = useMemo(() => {
    const searchTerm = boloSearch.trim().toLowerCase();
    if (!searchTerm) return bolosCatalogo;

    return bolosCatalogo.filter((bolo) => {
      const matchesProduto = bolo.nome.toLowerCase().includes(searchTerm);
      const matchesVariacao = bolo.variacoes.some((variacao) => {
        return [
          variacao.nome,
          variacao.tamanho,
          variacao.cobertura,
        ].some((value) => value?.toLowerCase().includes(searchTerm));
      });

      return matchesProduto || matchesVariacao;
    });
  }, [bolosCatalogo, boloSearch]);

  const filteredBrigadeiros = useMemo(() => {
    const searchTerm = search.trim().toLowerCase();

    return produtosBrigadeiro
      .filter((brigadeiro) => {
        const matchesSearch = !searchTerm || brigadeiro.nome.toLowerCase().includes(searchTerm);
        const matchesTamanho = matchesBrigadeiroTamanhoFilter(brigadeiro, tamanhoFilter);
        return matchesSearch && matchesTamanho;
      })
      .sort((a, b) => {
        const nomeBaseCompare = getProdutoNomeComercial(a).localeCompare(getProdutoNomeComercial(b), 'pt-BR');
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
  const [boloFormErrors, setBoloFormErrors] = useState<BoloFormErrors>({});
  const [variacaoFormErrors, setVariacaoFormErrors] = useState<BoloFormErrors>({});
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

  const handleOpenBoloDialog = () => {
    setBoloFormData({
      nome: '',
      variacao: '',
      tamanho: '',
      cobertura: '',
      preco_venda: '',
      custo_calculado: '',
      validade_dias: '',
      prazo_minimo_dias: '',
      modelo_producao: 'sob_encomenda',
    });
    setBoloFormErrors({});
    setIsBoloDialogOpen(true);
  };

  const handleOpenVariacaoDialog = (bolo: ProdutoCatalogo) => {
    setSelectedBoloForVariation(bolo);
    setEditingBoloVariation(null);
    setVariacaoFormData({
      variacao: '',
      tamanho: '',
      cobertura: '',
      preco_venda: '',
      custo_calculado: '',
      validade_dias: bolo.validade_dias?.toString() ?? '',
      prazo_minimo_dias: bolo.prazo_minimo_dias?.toString() ?? '',
      modelo_producao: bolo.modelo_producao,
    });
    setVariacaoFormErrors({});
    setIsVariacaoDialogOpen(true);
  };

  const handleOpenEditVariacaoDialog = (bolo: ProdutoCatalogo, variacao: ProdutoCatalogoVariacao) => {
    const modeloProducao = variacao.disponivel_sob_encomenda && variacao.disponivel_pronta_entrega
      ? 'ambos'
      : variacao.disponivel_pronta_entrega
        ? 'pronta_entrega'
        : 'sob_encomenda';

    setSelectedBoloForVariation(bolo);
    setEditingBoloVariation(variacao);
    setVariacaoFormData({
      variacao: variacao.nome,
      tamanho: variacao.tamanho ?? '',
      cobertura: variacao.cobertura ?? '',
      preco_venda: variacao.preco_venda.toString(),
      custo_calculado: variacao.custo_calculado.toString(),
      validade_dias: variacao.validade_dias?.toString() ?? '',
      prazo_minimo_dias: variacao.prazo_minimo_dias?.toString() ?? '',
      modelo_producao: modeloProducao,
    });
    setVariacaoFormErrors({});
    setIsVariacaoDialogOpen(true);
  };

  const handleSaveBolo = async () => {
    const errors: BoloFormErrors = {};
    const precoVenda = parseDecimalInput(boloFormData.preco_venda);
    const custoCalculado = parseDecimalInput(boloFormData.custo_calculado);
    const validadeDias = boloFormData.validade_dias.trim() ? Number(boloFormData.validade_dias) : null;
    const prazoMinimoDias = boloFormData.prazo_minimo_dias.trim() ? Number(boloFormData.prazo_minimo_dias) : null;

    if (!boloFormData.nome.trim()) errors.nome = 'Informe o nome do bolo';
    if (!boloFormData.variacao.trim()) errors.variacao = 'Informe a variação';
    if (!Number.isFinite(precoVenda) || precoVenda <= 0) errors.preco_venda = 'Preço de venda deve ser maior que zero';
    if (!Number.isFinite(custoCalculado) || custoCalculado < 0) errors.custo_calculado = 'Custo não pode ser negativo';

    setBoloFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSavingBolo(true);
    try {
      const created = await addProdutoComVariacao({
        categoria_codigo: 'bolo',
        nome: boloFormData.nome.trim(),
        modelo_producao: boloFormData.modelo_producao,
        validade_dias: Number.isFinite(validadeDias) ? validadeDias : null,
        prazo_minimo_dias: Number.isFinite(prazoMinimoDias) ? prazoMinimoDias : null,
        necessita_refrigeracao: Boolean(boloFormData.cobertura.trim()),
        variacao_nome: boloFormData.variacao.trim(),
        variacao_tamanho: boloFormData.tamanho.trim() || null,
        variacao_cobertura: boloFormData.cobertura.trim() || null,
        variacao_preco_venda: precoVenda,
        variacao_custo_calculado: custoCalculado,
        variacao_sob_encomenda: boloFormData.modelo_producao !== 'pronta_entrega',
        variacao_pronta_entrega: boloFormData.modelo_producao !== 'sob_encomenda',
      });

      if (created) setIsBoloDialogOpen(false);
    } finally {
      setSavingBolo(false);
    }
  };

  const handleSaveVariacaoBolo = async () => {
    if (!selectedBoloForVariation) return;

    const errors: BoloFormErrors = {};
    const precoVenda = parseDecimalInput(variacaoFormData.preco_venda);
    const custoCalculado = parseDecimalInput(variacaoFormData.custo_calculado);
    const validadeDias = variacaoFormData.validade_dias.trim() ? Number(variacaoFormData.validade_dias) : null;
    const prazoMinimoDias = variacaoFormData.prazo_minimo_dias.trim() ? Number(variacaoFormData.prazo_minimo_dias) : null;

    if (!variacaoFormData.variacao.trim()) errors.variacao = 'Informe a variação';
    if (!Number.isFinite(precoVenda) || precoVenda <= 0) errors.preco_venda = 'Preço de venda deve ser maior que zero';
    if (!Number.isFinite(custoCalculado) || custoCalculado < 0) errors.custo_calculado = 'Custo não pode ser negativo';

    setVariacaoFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSavingVariacao(true);
    try {
      const payload = {
        variacao_nome: variacaoFormData.variacao.trim(),
        variacao_tamanho: variacaoFormData.tamanho.trim() || null,
        variacao_cobertura: variacaoFormData.cobertura.trim() || null,
        variacao_preco_venda: precoVenda,
        variacao_custo_calculado: custoCalculado,
        variacao_sob_encomenda: variacaoFormData.modelo_producao !== 'pronta_entrega',
        variacao_pronta_entrega: variacaoFormData.modelo_producao !== 'sob_encomenda',
        validade_dias: Number.isFinite(validadeDias) ? validadeDias : null,
        prazo_minimo_dias: Number.isFinite(prazoMinimoDias) ? prazoMinimoDias : null,
      };

      const saved = editingBoloVariation
        ? await updateVariacaoProduto(editingBoloVariation.id, payload)
        : await addVariacaoProduto({
            produto_id: selectedBoloForVariation.id,
            ...payload,
          });

      if (saved) {
        setIsVariacaoDialogOpen(false);
        setSelectedBoloForVariation(null);
        setEditingBoloVariation(null);
      }
    } finally {
      setSavingVariacao(false);
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
          <p className="text-muted-foreground mt-1">Gerencie o catálogo de brigadeiros e bolos</p>
        </div>
        {categoriaView === 'brigadeiro' ? (
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} className="gap-2">
              <Plus size={18} />
              Novo Produto
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
        ) : (
          <Dialog open={isBoloDialogOpen} onOpenChange={setIsBoloDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleOpenBoloDialog} className="gap-2">
                <Plus size={18} />
                Novo Bolo
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="font-display">Novo Bolo</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bolo-nome">Nome do bolo</Label>
                    <Input
                      id="bolo-nome"
                      value={boloFormData.nome}
                      onChange={(e) => {
                        setBoloFormData({ ...boloFormData, nome: e.target.value });
                        if (boloFormErrors.nome) setBoloFormErrors({ ...boloFormErrors, nome: '' });
                      }}
                      placeholder="Ex: Bolo de cenoura"
                      aria-invalid={!!boloFormErrors.nome}
                      aria-describedby={boloFormErrors.nome ? 'bolo-nome-error' : undefined}
                    />
                    {boloFormErrors.nome && <p id="bolo-nome-error" className="text-xs text-destructive">{boloFormErrors.nome}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bolo-variacao">Variação</Label>
                    <Input
                      id="bolo-variacao"
                      value={boloFormData.variacao}
                      onChange={(e) => {
                        setBoloFormData({ ...boloFormData, variacao: e.target.value });
                        if (boloFormErrors.variacao) setBoloFormErrors({ ...boloFormErrors, variacao: '' });
                      }}
                      placeholder="Ex: Pequeno com cobertura"
                      aria-invalid={!!boloFormErrors.variacao}
                      aria-describedby={boloFormErrors.variacao ? 'bolo-variacao-error' : undefined}
                    />
                    {boloFormErrors.variacao && <p id="bolo-variacao-error" className="text-xs text-destructive">{boloFormErrors.variacao}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bolo-tamanho">Tamanho</Label>
                    <Input
                      id="bolo-tamanho"
                      value={boloFormData.tamanho}
                      onChange={(e) => setBoloFormData({ ...boloFormData, tamanho: e.target.value })}
                      placeholder="Ex: Pequeno"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bolo-cobertura">Cobertura</Label>
                    <Input
                      id="bolo-cobertura"
                      value={boloFormData.cobertura}
                      onChange={(e) => setBoloFormData({ ...boloFormData, cobertura: e.target.value })}
                      placeholder="Ex: Chocolate"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bolo-modelo-producao">Produção</Label>
                    <select
                      id="bolo-modelo-producao"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      value={boloFormData.modelo_producao}
                      onChange={(e) => setBoloFormData({ ...boloFormData, modelo_producao: e.target.value })}
                    >
                      <option value="sob_encomenda">Sob encomenda</option>
                      <option value="pronta_entrega">Pronta entrega</option>
                      <option value="ambos">Ambos</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bolo-preco-venda">Preço de venda (R$)</Label>
                    <Input
                      id="bolo-preco-venda"
                      type="text"
                      inputMode="decimal"
                      value={boloFormData.preco_venda}
                      onChange={(e) => {
                        setBoloFormData({ ...boloFormData, preco_venda: e.target.value });
                        if (boloFormErrors.preco_venda) setBoloFormErrors({ ...boloFormErrors, preco_venda: '' });
                      }}
                      placeholder="Ex: 35,00"
                      aria-invalid={!!boloFormErrors.preco_venda}
                      aria-describedby={boloFormErrors.preco_venda ? 'bolo-preco-error' : undefined}
                    />
                    {boloFormErrors.preco_venda && <p id="bolo-preco-error" className="text-xs text-destructive">{boloFormErrors.preco_venda}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bolo-custo">Custo estimado (R$)</Label>
                    <Input
                      id="bolo-custo"
                      type="text"
                      inputMode="decimal"
                      value={boloFormData.custo_calculado}
                      onChange={(e) => {
                        setBoloFormData({ ...boloFormData, custo_calculado: e.target.value });
                        if (boloFormErrors.custo_calculado) setBoloFormErrors({ ...boloFormErrors, custo_calculado: '' });
                      }}
                      placeholder="Ex: 14,50"
                      aria-invalid={!!boloFormErrors.custo_calculado}
                      aria-describedby={boloFormErrors.custo_calculado ? 'bolo-custo-error' : undefined}
                    />
                    {boloFormErrors.custo_calculado && <p id="bolo-custo-error" className="text-xs text-destructive">{boloFormErrors.custo_calculado}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="bolo-validade">Validade (dias)</Label>
                    <Input
                      id="bolo-validade"
                      type="number"
                      min="0"
                      value={boloFormData.validade_dias}
                      onChange={(e) => setBoloFormData({ ...boloFormData, validade_dias: e.target.value })}
                      placeholder="Opcional"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bolo-prazo">Prazo mínimo (dias)</Label>
                    <Input
                      id="bolo-prazo"
                      type="number"
                      min="0"
                      value={boloFormData.prazo_minimo_dias}
                      onChange={(e) => setBoloFormData({ ...boloFormData, prazo_minimo_dias: e.target.value })}
                      placeholder="Opcional"
                    />
                  </div>
                </div>

                <Button onClick={handleSaveBolo} className="w-full" disabled={savingBolo}>
                  {savingBolo ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Adicionar Bolo
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Dialog open={isVariacaoDialogOpen} onOpenChange={(isOpen) => {
        setIsVariacaoDialogOpen(isOpen);
        if (!isOpen) {
          setSelectedBoloForVariation(null);
          setEditingBoloVariation(null);
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editingBoloVariation ? 'Editar variação' : 'Nova variação'}
              {selectedBoloForVariation ? ` — ${selectedBoloForVariation.nome}` : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bolo-variacao-extra">Variação</Label>
              <Input
                id="bolo-variacao-extra"
                value={variacaoFormData.variacao}
                onChange={(e) => {
                  setVariacaoFormData({ ...variacaoFormData, variacao: e.target.value });
                  if (variacaoFormErrors.variacao) setVariacaoFormErrors({ ...variacaoFormErrors, variacao: '' });
                }}
                placeholder="Ex: Pequeno com cobertura"
                aria-invalid={!!variacaoFormErrors.variacao}
                aria-describedby={variacaoFormErrors.variacao ? 'bolo-variacao-extra-error' : undefined}
              />
              {variacaoFormErrors.variacao && <p id="bolo-variacao-extra-error" className="text-xs text-destructive">{variacaoFormErrors.variacao}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bolo-tamanho-extra">Tamanho</Label>
                <Input
                  id="bolo-tamanho-extra"
                  value={variacaoFormData.tamanho}
                  onChange={(e) => setVariacaoFormData({ ...variacaoFormData, tamanho: e.target.value })}
                  placeholder="Ex: Pequeno"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bolo-cobertura-extra">Cobertura</Label>
                <Input
                  id="bolo-cobertura-extra"
                  value={variacaoFormData.cobertura}
                  onChange={(e) => setVariacaoFormData({ ...variacaoFormData, cobertura: e.target.value })}
                  placeholder="Ex: Chocolate"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bolo-modelo-producao-extra">Produção</Label>
                <select
                  id="bolo-modelo-producao-extra"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  value={variacaoFormData.modelo_producao}
                  onChange={(e) => setVariacaoFormData({ ...variacaoFormData, modelo_producao: e.target.value })}
                >
                  <option value="sob_encomenda">Sob encomenda</option>
                  <option value="pronta_entrega">Pronta entrega</option>
                  <option value="ambos">Ambos</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bolo-preco-venda-extra">Preço de venda (R$)</Label>
                <Input
                  id="bolo-preco-venda-extra"
                  type="text"
                  inputMode="decimal"
                  value={variacaoFormData.preco_venda}
                  onChange={(e) => {
                    setVariacaoFormData({ ...variacaoFormData, preco_venda: e.target.value });
                    if (variacaoFormErrors.preco_venda) setVariacaoFormErrors({ ...variacaoFormErrors, preco_venda: '' });
                  }}
                  placeholder="Ex: 35,00"
                  aria-invalid={!!variacaoFormErrors.preco_venda}
                  aria-describedby={variacaoFormErrors.preco_venda ? 'bolo-preco-extra-error' : undefined}
                />
                {variacaoFormErrors.preco_venda && <p id="bolo-preco-extra-error" className="text-xs text-destructive">{variacaoFormErrors.preco_venda}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="bolo-custo-extra">Custo estimado (R$)</Label>
                <Input
                  id="bolo-custo-extra"
                  type="text"
                  inputMode="decimal"
                  value={variacaoFormData.custo_calculado}
                  onChange={(e) => {
                    setVariacaoFormData({ ...variacaoFormData, custo_calculado: e.target.value });
                    if (variacaoFormErrors.custo_calculado) setVariacaoFormErrors({ ...variacaoFormErrors, custo_calculado: '' });
                  }}
                  placeholder="Ex: 14,50"
                  aria-invalid={!!variacaoFormErrors.custo_calculado}
                  aria-describedby={variacaoFormErrors.custo_calculado ? 'bolo-custo-extra-error' : undefined}
                />
                {variacaoFormErrors.custo_calculado && <p id="bolo-custo-extra-error" className="text-xs text-destructive">{variacaoFormErrors.custo_calculado}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="bolo-validade-extra">Validade (dias)</Label>
                <Input
                  id="bolo-validade-extra"
                  type="number"
                  min="0"
                  value={variacaoFormData.validade_dias}
                  onChange={(e) => setVariacaoFormData({ ...variacaoFormData, validade_dias: e.target.value })}
                  placeholder="Opcional"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bolo-prazo-extra">Prazo mínimo (dias)</Label>
                <Input
                  id="bolo-prazo-extra"
                  type="number"
                  min="0"
                  value={variacaoFormData.prazo_minimo_dias}
                  onChange={(e) => setVariacaoFormData({ ...variacaoFormData, prazo_minimo_dias: e.target.value })}
                  placeholder="Opcional"
                />
              </div>
            </div>

            <Button onClick={handleSaveVariacaoBolo} className="w-full" disabled={savingVariacao}>
              {savingVariacao ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editingBoloVariation ? 'Salvar variação' : 'Adicionar variação'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Tabs value={categoriaView} onValueChange={(value) => setCategoriaView(value as ProdutoCategoria)}>
        <TabsList className="grid h-auto w-full max-w-md grid-cols-2 rounded-lg border border-border bg-muted/40 p-1">
          <TabsTrigger value="brigadeiro" className="rounded-md">Brigadeiros</TabsTrigger>
          <TabsTrigger value="bolo" className="rounded-md">Bolos</TabsTrigger>
        </TabsList>

        <TabsContent value="brigadeiro" className="mt-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase text-muted-foreground">Brigadeiros ativos</p>
              <p className="mt-2 font-display text-3xl font-semibold text-foreground">{produtosResumo.total}</p>
              <p className="text-sm text-muted-foreground">Produtos da aba Brigadeiros</p>
            </div>
            <div className="rounded-xl bg-primary/10 p-3 text-primary">
              <Package size={22} aria-hidden="true" />
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase text-muted-foreground">Tamanhos de brigadeiros</p>
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
            <Label htmlFor="produto-busca" className="sr-only">Buscar produtos</Label>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              id="produto-busca"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produtos..."
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
              {search ? 'Tente ajustar a busca.' : 'Clique em "Novo Produto" para adicionar seu primeiro produto.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {filteredBrigadeiros.map((brigadeiro) => {
              const tamanho = getProdutoTamanhoComercial(brigadeiro);
              const nomeBase = getProdutoNomeComercial(brigadeiro);
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
                          aria-label={`Inativar ${brigadeiro.nome}`}
                        >
                          <Trash2 size={16} className="text-destructive" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Inativar produto?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {brigadeiro.nome} sairá dos cadastros operacionais, mas pedidos e registros antigos continuarão preservados.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteBrigadeiro(brigadeiro.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Inativar
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
        </TabsContent>

        <TabsContent value="bolo" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase text-muted-foreground">Bolos ativos</p>
                  <p className="mt-2 font-display text-3xl font-semibold text-foreground">
                    {loadingCatalogo ? '—' : catalogoResumo.totalBolos}
                  </p>
                  <p className="text-sm text-muted-foreground">Produtos da categoria Bolo</p>
                </div>
                <div className="rounded-xl bg-primary/10 p-3 text-primary">
                  <CakeSlice size={22} aria-hidden="true" />
                </div>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase text-muted-foreground">Variações</p>
                  <p className="mt-2 font-display text-3xl font-semibold text-foreground">
                    {loadingCatalogo ? '—' : catalogoResumo.totalVariacoesBolos}
                  </p>
                  <p className="text-sm text-muted-foreground">Variações de bolos</p>
                </div>
                <div className="rounded-xl bg-accent/20 p-3 text-accent">
                  <Package size={22} aria-hidden="true" />
                </div>
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase text-muted-foreground">Estrutura</p>
                  <p className="mt-2 font-display text-3xl font-semibold text-foreground">Pronta</p>
                  <p className="text-sm text-muted-foreground">Produtos e variações em uso</p>
                </div>
                <div className="rounded-xl bg-success/10 p-3 text-success">
                  <TrendingUp size={22} aria-hidden="true" />
                </div>
              </div>
            </div>
          </div>

          <section aria-labelledby="bolos-lista-heading" className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <h2 id="bolos-lista-heading" className="sr-only">Lista de bolos</h2>
              <div className="relative w-full max-w-md">
                <Label htmlFor="bolo-busca" className="sr-only">Buscar bolos</Label>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  id="bolo-busca"
                  value={boloSearch}
                  onChange={(event) => setBoloSearch(event.target.value)}
                  placeholder="Buscar bolos..."
                  className="pl-10"
                />
              </div>
            </div>

            {filteredBolosCatalogo.length === 0 ? (
              <section className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <CakeSlice className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
                </div>
                <h2 className="font-display text-xl font-semibold text-foreground">
                  {boloSearch ? 'Nenhum bolo encontrado' : 'Nenhum bolo cadastrado'}
                </h2>
                <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
                  {boloSearch
                    ? 'Tente ajustar a busca por nome, tamanho ou cobertura.'
                    : 'Cadastre o primeiro bolo com uma variação inicial para deixá-lo disponível nos pedidos.'}
                </p>
              </section>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {filteredBolosCatalogo.map((bolo) => {
                  const variacaoPrincipal = bolo.variacoes[0];
                  const margem = variacaoPrincipal && variacaoPrincipal.preco_venda > 0
                    ? ((variacaoPrincipal.preco_venda - variacaoPrincipal.custo_calculado) / variacaoPrincipal.preco_venda) * 100
                    : 0;

                return (
                  <div key={bolo.id} className="bg-card border border-border rounded-lg p-4 card-hover shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                          Bolo
                        </span>
                        <h3 className="mt-3 line-clamp-2 min-h-[3rem] font-display text-lg font-semibold leading-tight">
                          {bolo.nome}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {bolo.variacoes.length} variação{bolo.variacoes.length === 1 ? '' : 'ões'}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleOpenVariacaoDialog(bolo)}
                          aria-label={`Adicionar variação para ${bolo.nome}`}
                        >
                          <Plus size={16} />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button
                              className="rounded-md p-1.5 transition-colors hover:bg-destructive/10"
                              aria-label={`Inativar ${bolo.nome}`}
                            >
                              <Trash2 size={16} className="text-destructive" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Inativar bolo?</AlertDialogTitle>
                              <AlertDialogDescription>
                                {bolo.nome} sairá dos cadastros operacionais, mas registros antigos continuarão preservados.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteProduto(bolo.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Inativar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>

                    {variacaoPrincipal ? (
                      <>
                        <div className="mt-3 space-y-2">
                          {bolo.variacoes.slice(0, 3).map((variacao) => (
                            <div key={variacao.id} className="rounded-md border border-border bg-muted/30 px-3 py-2">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium">{variacao.nome}</p>
                                  <div className="mt-0.5 flex flex-wrap gap-1 text-xs text-muted-foreground">
                                    {variacao.tamanho ? <span>{variacao.tamanho}</span> : null}
                                    {variacao.cobertura ? <span>• {variacao.cobertura}</span> : null}
                                  </div>
                                </div>
                                <div className="flex shrink-0 items-center gap-1">
                                  <p className="mr-1 text-sm font-semibold text-success">{formatCurrencyBRL(variacao.preco_venda)}</p>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => handleOpenEditVariacaoDialog(bolo, variacao)}
                                    aria-label={`Editar variação ${variacao.nome}`}
                                  >
                                    <Pencil size={14} />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <button
                                        className="rounded-md p-1.5 transition-colors hover:bg-destructive/10"
                                        aria-label={`Inativar variação ${variacao.nome}`}
                                      >
                                        <Trash2 size={14} className="text-destructive" />
                                      </button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Inativar variação?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          {variacao.nome} sairá das opções de venda, mas pedidos antigos continuarão preservados.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => deleteVariacaoProduto(variacao.id)}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                          Inativar
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </div>
                            </div>
                          ))}
                          {bolo.variacoes.length > 3 && (
                            <p className="text-xs text-muted-foreground">
                              + {bolo.variacoes.length - 3} variação{bolo.variacoes.length - 3 === 1 ? '' : 'ões'}
                            </p>
                          )}
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3">
                          <div>
                            <p className="text-xs text-muted-foreground">Venda</p>
                            <p className="text-sm font-semibold text-success">{formatCurrencyBRL(variacaoPrincipal.preco_venda)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Custo</p>
                            <p className="text-sm font-medium">{formatCurrencyBRL(variacaoPrincipal.custo_calculado)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Margem</p>
                            <p className="text-sm font-medium text-accent">{margem.toFixed(1)}%</p>
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">Sem variação ativa cadastrada.</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
