import { useMemo, useState } from 'react';
import { Plus, AlertTriangle, Package, Loader2, ArrowUpCircle, ArrowDownCircle, Trash2, Pencil, ShoppingCart, Search } from 'lucide-react';
import { useInsumos, Insumo } from '@/hooks/useInsumos';
import { useEstoqueMassas, EstoqueMassa } from '@/hooks/useEstoqueMassas';
import { useEstoqueProdutos, EstoqueProduto } from '@/hooks/useEstoqueProdutos';
import { Brigadeiro, useBrigadeiros } from '@/hooks/useBrigadeiros';
import { useFornecedores } from '@/hooks/useFornecedores';
import { useInsumoPurchaseEntries } from '@/hooks/useInsumoPurchaseEntries';
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
} from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { cn, formatCurrencyBRL, formatLocalDate } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import {
  BRIGADEIRO_TAMANHO_FILTERS,
  type BrigadeiroTamanhoFilter,
  filterProdutosBrigadeiro,
  getProdutoNomeBase,
  getProdutoTamanhoComercial,
  matchesBrigadeiroTamanhoFilter,
  type ProdutoCategoriaInput,
} from '@/domain/produtos';
import { parseDecimalInput, parseIntegerInput } from '@/domain/numeros';
import { calculateInsumoPurchaseQuantity, getInsumoStockStatus } from '@/domain/estoque';
import {
  INSUMO_UNIDADES,
  getInsumoQuantidadePlaceholder,
  getInsumoUnidadeLabel,
  isInsumoUnidadePadrao,
} from '@/domain/insumos';

type InsumoFormErrors = Partial<Record<
  'nome' | 'unidade' | 'quantidade_minima',
  string
>>;

type InsumoEntryErrors = Partial<Record<
  'quantidade_embalagens' | 'conteudo_por_embalagem' | 'valor_total' | 'data_compra',
  string
>>;

type InsumoStockFilter = 'todos' | 'atencao' | 'sem-minimo';
type InsumoSortOption = 'nome' | 'menor-saldo' | 'maior-saldo' | 'ultimo-custo';

function getTamanhoSortValue(tamanho: string | null) {
  return Number(tamanho?.replace(',', '.').replace(/g$/i, '') ?? Number.POSITIVE_INFINITY);
}

function getProdutoCatalogoNome(produto: { nome?: string | null | undefined }) {
  return produto.nome || '';
}

function formatInsumoQuantidade(value: number) {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

function formatCurrencyBRLPrecise(value: number) {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}

function sortByProdutoNomeETamanho<T extends ProdutoCategoriaInput>(a: T, b: T) {
  const nomeA = getProdutoCatalogoNome(a);
  const nomeB = getProdutoCatalogoNome(b);
  const nomeBaseCompare = getProdutoNomeBase(nomeA).localeCompare(getProdutoNomeBase(nomeB), 'pt-BR');
  if (nomeBaseCompare !== 0) return nomeBaseCompare;
  return getTamanhoSortValue(getProdutoTamanhoComercial(a)) - getTamanhoSortValue(getProdutoTamanhoComercial(b));
}

function getProdutoFinalCatalogo(produto: EstoqueProduto, brigadeirosPorId: Map<string, Brigadeiro>) {
  return brigadeirosPorId.get(produto.brigadeiro_id) ?? {
    nome: produto.brigadeiro?.nome || 'Carregando...',
    categoria: 'brigadeiro',
    tamanho_g: null,
  };
}

function InsumosTab() {
  const { insumos, loading, addInsumo, updateInsumo, registerInsumoEntry } = useInsumos();
  const { fornecedores } = useFornecedores();
  const [purchaseInsumoFilter, setPurchaseInsumoFilter] = useState('todos');
  const [purchaseFornecedorFilter, setPurchaseFornecedorFilter] = useState('todos');
  const [insumoSearch, setInsumoSearch] = useState('');
  const [insumoStockFilter, setInsumoStockFilter] = useState<InsumoStockFilter>('todos');
  const [insumoSort, setInsumoSort] = useState<InsumoSortOption>('nome');
  const { entries: purchaseEntries, loading: purchaseEntriesLoading, refetch: refetchPurchaseEntries } = useInsumoPurchaseEntries({
    fornecedorId: purchaseFornecedorFilter,
    insumoId: purchaseInsumoFilter,
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [editingInsumo, setEditingInsumo] = useState<Insumo | null>(null);
  const [entryInsumo, setEntryInsumo] = useState<Insumo | null>(null);
  const [saving, setSaving] = useState(false);
  const [entrySaving, setEntrySaving] = useState(false);
  const [formErrors, setFormErrors] = useState<InsumoFormErrors>({});
  const [entryErrors, setEntryErrors] = useState<InsumoEntryErrors>({});
  const [formData, setFormData] = useState({
    nome: '',
    unidade: 'g',
    quantidade_minima: '',
  });
  const [entryFormData, setEntryFormData] = useState({
    quantidade_embalagens: '',
    conteudo_por_embalagem: '',
    valor_total: '',
    data_compra: new Date().toISOString().slice(0, 10),
    fornecedor_id: 'sem-fornecedor',
  });
  const fornecedoresAtivos = fornecedores.filter((fornecedor) => fornecedor.ativo);
  const insumosPorId = useMemo(() => new Map(insumos.map((insumo) => [insumo.id, insumo])), [insumos]);
  const fornecedoresPorId = useMemo(() => new Map(fornecedores.map((fornecedor) => [fornecedor.id, fornecedor])), [fornecedores]);
  const filteredInsumos = useMemo(() => {
    const searchTerm = insumoSearch.trim().toLowerCase();
    const filtered = insumos.filter((insumo) => {
      const stockStatus = getInsumoStockStatus(insumo.quantidade_atual, insumo.quantidade_minima);
      const matchesSearch = !searchTerm
        || insumo.nome.toLowerCase().includes(searchTerm)
        || insumo.unidade.toLowerCase().includes(searchTerm);
      const matchesStockFilter = insumoStockFilter === 'todos'
        || (insumoStockFilter === 'atencao' && stockStatus.needsAttention)
        || (insumoStockFilter === 'sem-minimo' && stockStatus.status === 'unset');

      return matchesSearch && matchesStockFilter;
    });

    return [...filtered].sort((a, b) => {
      if (insumoSort === 'menor-saldo') {
        return a.quantidade_atual - b.quantidade_atual || a.nome.localeCompare(b.nome, 'pt-BR');
      }

      if (insumoSort === 'maior-saldo') {
        return b.quantidade_atual - a.quantidade_atual || a.nome.localeCompare(b.nome, 'pt-BR');
      }

      if (insumoSort === 'ultimo-custo') {
        return b.preco_unitario - a.preco_unitario || a.nome.localeCompare(b.nome, 'pt-BR');
      }

      return a.nome.localeCompare(b.nome, 'pt-BR');
    });
  }, [insumoSearch, insumoSort, insumoStockFilter, insumos]);

  const insumosEmFalta = insumos.filter(i => getInsumoStockStatus(i.quantidade_atual, i.quantidade_minima).needsAttention);
  const valorTotalEstoque = insumos.reduce((acc, i) => acc + (i.quantidade_atual * i.preco_unitario), 0);
  const hasActivePurchaseFilters = purchaseInsumoFilter !== 'todos' || purchaseFornecedorFilter !== 'todos';
  const hasActiveInsumoFilters = !!insumoSearch.trim() || insumoStockFilter !== 'todos' || insumoSort !== 'nome';

  const handleClearPurchaseFilters = () => {
    setPurchaseInsumoFilter('todos');
    setPurchaseFornecedorFilter('todos');
  };

  const handleClearInsumoFilters = () => {
    setInsumoSearch('');
    setInsumoStockFilter('todos');
    setInsumoSort('nome');
  };

  const handleShowAllInsumos = () => {
    handleClearInsumoFilters();
  };

  const handleShowInsumosEmFalta = () => {
    setInsumoSearch('');
    setInsumoStockFilter('atencao');
  };

  const handleOpenDialog = (insumo?: Insumo) => {
    if (insumo) {
      setEditingInsumo(insumo);
      setFormData({
        nome: insumo.nome,
        unidade: insumo.unidade,
        quantidade_minima: insumo.quantidade_minima.toString(),
      });
    } else {
      setEditingInsumo(null);
      setFormData({
        nome: '',
        unidade: 'g',
        quantidade_minima: '',
      });
    }
    setFormErrors({});
    setIsDialogOpen(true);
  };

  const handleOpenEntryDialog = (insumo: Insumo) => {
    setEntryInsumo(insumo);
    setEntryFormData({
      quantidade_embalagens: '',
      conteudo_por_embalagem: '',
      valor_total: '',
      data_compra: new Date().toISOString().slice(0, 10),
      fornecedor_id: 'sem-fornecedor',
    });
    setEntryErrors({});
    setEntryDialogOpen(true);
  };

  const handleSave = async () => {
    const quantidadeMinima = formData.quantidade_minima.trim() ? parseDecimalInput(formData.quantidade_minima) : 0;
    const errors: InsumoFormErrors = {};

    if (!formData.nome.trim()) errors.nome = 'Informe o nome do insumo';
    if (!formData.unidade.trim()) errors.unidade = 'Informe a unidade';
    if (!Number.isFinite(quantidadeMinima) || quantidadeMinima < 0) errors.quantidade_minima = 'Informe uma quantidade mínima válida';

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      if (editingInsumo) {
        await updateInsumo(editingInsumo.id, {
          nome: formData.nome.trim(),
          unidade: formData.unidade,
          quantidade_minima: quantidadeMinima,
        });
      } else {
        await addInsumo({
          nome: formData.nome.trim(),
          unidade: formData.unidade,
          quantidade_atual: 0,
          quantidade_minima: quantidadeMinima,
          consumo_medio: 0,
          preco_unitario: 0,
        });
      }
      setIsDialogOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEntry = async () => {
    if (!entryInsumo) return;

    const quantidadeEmbalagens = parseDecimalInput(entryFormData.quantidade_embalagens);
    const conteudoPorEmbalagem = parseDecimalInput(entryFormData.conteudo_por_embalagem);
    const valorTotalEntrada = entryFormData.valor_total.trim() ? parseDecimalInput(entryFormData.valor_total) : 0;
    const errors: InsumoEntryErrors = {};

    if (!Number.isFinite(quantidadeEmbalagens) || quantidadeEmbalagens <= 0) {
      errors.quantidade_embalagens = 'Informe uma quantidade maior que zero';
    }
    if (!Number.isFinite(conteudoPorEmbalagem) || conteudoPorEmbalagem <= 0) {
      errors.conteudo_por_embalagem = 'Informe o conteúdo por embalagem';
    }
    if (!Number.isFinite(valorTotalEntrada) || valorTotalEntrada < 0) {
      errors.valor_total = 'Informe um valor total válido';
    }
    if (!entryFormData.data_compra) {
      errors.data_compra = 'Informe a data da compra';
    }

    setEntryErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setEntrySaving(true);
    try {
      const quantidadeEntrada = calculateInsumoPurchaseQuantity(quantidadeEmbalagens, conteudoPorEmbalagem);
      const updatedInsumo = await registerInsumoEntry(
        entryInsumo.id,
        quantidadeEntrada,
        valorTotalEntrada,
        entryFormData.data_compra,
        entryFormData.fornecedor_id === 'sem-fornecedor' ? null : entryFormData.fornecedor_id,
      );
      if (updatedInsumo) {
        await refetchPurchaseEntries();
        setEntryDialogOpen(false);
      }
    } finally {
      setEntrySaving(false);
    }
  };

  const previewQuantidadeEmbalagens = parseDecimalInput(entryFormData.quantidade_embalagens);
  const previewConteudoPorEmbalagem = parseDecimalInput(entryFormData.conteudo_por_embalagem);
  const previewQuantidadeTotal = Number.isFinite(previewQuantidadeEmbalagens)
    && previewQuantidadeEmbalagens > 0
    && Number.isFinite(previewConteudoPorEmbalagem)
    && previewConteudoPorEmbalagem > 0
      ? calculateInsumoPurchaseQuantity(previewQuantidadeEmbalagens, previewConteudoPorEmbalagem)
      : null;

  if (loading) return <div className="py-8 text-center text-muted-foreground"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-display font-semibold">Tabela de Insumos</h2>
        <Button onClick={() => handleOpenDialog()} className="gap-2">
          <Plus size={18} /> Novo Insumo
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">
                {editingInsumo ? 'Editar Insumo' : 'Novo Insumo'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="insumo-nome">Nome</Label>
                  <Input id="insumo-nome" value={formData.nome} onChange={(e) => {
                    setFormData({ ...formData, nome: e.target.value });
                    if (formErrors.nome) setFormErrors({ ...formErrors, nome: '' });
                  }} placeholder="Ex: Leite Condensado" aria-invalid={!!formErrors.nome} aria-describedby={formErrors.nome ? 'insumo-nome-error' : undefined} />
                  {formErrors.nome && <p id="insumo-nome-error" className="text-xs text-destructive">{formErrors.nome}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="insumo-unidade">Unidade</Label>
                  <select
                    id="insumo-unidade"
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    value={formData.unidade}
                    onChange={(e) => {
                      setFormData({ ...formData, unidade: e.target.value });
                      if (formErrors.unidade) setFormErrors({ ...formErrors, unidade: '' });
                    }}
                    aria-invalid={!!formErrors.unidade}
                    aria-describedby={formErrors.unidade ? 'insumo-unidade-error' : undefined}
                  >
                    {!isInsumoUnidadePadrao(formData.unidade) && formData.unidade && (
                      <option value={formData.unidade}>Atual: {formData.unidade}</option>
                    )}
                    {INSUMO_UNIDADES.map((unidade) => (
                      <option key={unidade.value} value={unidade.value}>{unidade.label}</option>
                    ))}
                  </select>
                  {formErrors.unidade && <p id="insumo-unidade-error" className="text-xs text-destructive">{formErrors.unidade}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="insumo-quantidade-minima">Quantidade mínima ({formData.unidade})</Label>
                  <Input id="insumo-quantidade-minima" type="text" inputMode="decimal" value={formData.quantidade_minima} onChange={(e) => {
                    setFormData({ ...formData, quantidade_minima: e.target.value });
                    if (formErrors.quantidade_minima) setFormErrors({ ...formErrors, quantidade_minima: '' });
                  }} placeholder={getInsumoQuantidadePlaceholder(formData.unidade)} aria-invalid={!!formErrors.quantidade_minima} aria-describedby={formErrors.quantidade_minima ? 'insumo-quantidade-minima-error' : undefined} />
                  {formErrors.quantidade_minima && <p id="insumo-quantidade-minima-error" className="text-xs text-destructive">{formErrors.quantidade_minima}</p>}
                  <p className="text-xs text-muted-foreground">Opcional. Use apenas para alertas de estoque baixo.</p>
                </div>
              </div>
              {!editingInsumo && (
                <p className="text-sm text-muted-foreground">
                  Depois de cadastrar, use Registrar entrada para informar compra, quantidade e custo.
                </p>
              )}
              <Button onClick={handleSave} className="w-full" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editingInsumo ? 'Salvar Alterações' : 'Adicionar Insumo'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      <Dialog open={entryDialogOpen} onOpenChange={setEntryDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Registrar entrada</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Insumo: <strong className="text-foreground">{entryInsumo?.nome}</strong>
              {entryInsumo && (
                <span> • controle em {getInsumoUnidadeLabel(entryInsumo.unidade)}</span>
              )}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="insumo-entry-quantidade-embalagens">Embalagens compradas</Label>
                <Input
                  id="insumo-entry-quantidade-embalagens"
                  type="text"
                  inputMode="decimal"
                  value={entryFormData.quantidade_embalagens}
                  onChange={(e) => {
                    setEntryFormData({ ...entryFormData, quantidade_embalagens: e.target.value });
                    if (entryErrors.quantidade_embalagens) setEntryErrors({ ...entryErrors, quantidade_embalagens: '' });
                  }}
                  placeholder="Ex: 10"
                  aria-invalid={!!entryErrors.quantidade_embalagens}
                  aria-describedby={entryErrors.quantidade_embalagens ? 'insumo-entry-quantidade-embalagens-error' : undefined}
                />
                {entryErrors.quantidade_embalagens && <p id="insumo-entry-quantidade-embalagens-error" className="text-xs text-destructive">{entryErrors.quantidade_embalagens}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="insumo-entry-conteudo">Conteúdo por embalagem ({entryInsumo?.unidade || 'unidade'})</Label>
                <Input
                  id="insumo-entry-conteudo"
                  type="text"
                  inputMode="decimal"
                  value={entryFormData.conteudo_por_embalagem}
                  onChange={(e) => {
                    setEntryFormData({ ...entryFormData, conteudo_por_embalagem: e.target.value });
                    if (entryErrors.conteudo_por_embalagem) setEntryErrors({ ...entryErrors, conteudo_por_embalagem: '' });
                  }}
                  placeholder={getInsumoQuantidadePlaceholder(entryInsumo?.unidade || '')}
                  aria-invalid={!!entryErrors.conteudo_por_embalagem}
                  aria-describedby={entryErrors.conteudo_por_embalagem ? 'insumo-entry-conteudo-error' : undefined}
                />
                {entryErrors.conteudo_por_embalagem && <p id="insumo-entry-conteudo-error" className="text-xs text-destructive">{entryErrors.conteudo_por_embalagem}</p>}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              Total a adicionar:{' '}
              <strong className="text-foreground">
                {previewQuantidadeTotal === null || !entryInsumo
                  ? '-'
                  : `${formatInsumoQuantidade(previewQuantidadeTotal)} ${entryInsumo.unidade}`}
              </strong>
            </div>
            <div className="space-y-2">
              <Label htmlFor="insumo-entry-fornecedor">Fornecedor</Label>
              <Select
                value={entryFormData.fornecedor_id}
                onValueChange={(value) => setEntryFormData({ ...entryFormData, fornecedor_id: value })}
              >
                <SelectTrigger id="insumo-entry-fornecedor">
                  <SelectValue placeholder="Selecione um fornecedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sem-fornecedor">Sem fornecedor informado</SelectItem>
                  {fornecedoresAtivos.map((fornecedor) => (
                    <SelectItem key={fornecedor.id} value={fornecedor.id}>
                      {fornecedor.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fornecedoresAtivos.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Cadastre fornecedores no menu Fornecedores para vincular compras.
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="insumo-entry-valor">Valor total (R$)</Label>
                <Input
                  id="insumo-entry-valor"
                  type="text"
                  inputMode="decimal"
                  value={entryFormData.valor_total}
                  onChange={(e) => {
                    setEntryFormData({ ...entryFormData, valor_total: e.target.value });
                    if (entryErrors.valor_total) setEntryErrors({ ...entryErrors, valor_total: '' });
                  }}
                  placeholder="Ex: 8,90"
                  aria-invalid={!!entryErrors.valor_total}
                  aria-describedby={entryErrors.valor_total ? 'insumo-entry-valor-error' : undefined}
                />
                {entryErrors.valor_total && <p id="insumo-entry-valor-error" className="text-xs text-destructive">{entryErrors.valor_total}</p>}
                <p className="text-xs text-muted-foreground">Se informado, o valor gera uma saída em Financeiro.</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="insumo-entry-data">Data da compra</Label>
              <Input
                id="insumo-entry-data"
                type="date"
                value={entryFormData.data_compra}
                onChange={(e) => {
                  setEntryFormData({ ...entryFormData, data_compra: e.target.value });
                  if (entryErrors.data_compra) setEntryErrors({ ...entryErrors, data_compra: '' });
                }}
                aria-invalid={!!entryErrors.data_compra}
                aria-describedby={entryErrors.data_compra ? 'insumo-entry-data-error' : undefined}
              />
              {entryErrors.data_compra && <p id="insumo-entry-data-error" className="text-xs text-destructive">{entryErrors.data_compra}</p>}
            </div>
            <Button onClick={handleSaveEntry} className="w-full" disabled={entrySaving}>
              {entrySaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShoppingCart className="w-4 h-4 mr-2" />}
              Registrar entrada
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-b border-border pb-6">
        <button
          type="button"
          onClick={handleShowAllInsumos}
          className={cn(
            "bg-card border border-border rounded-xl p-5 shadow-sm flex items-center gap-3 text-left transition-colors hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            insumoStockFilter === 'todos' && !insumoSearch.trim() && "border-primary/50 bg-primary/5"
          )}
          aria-label="Mostrar todos os insumos cadastrados"
        >
          <div className="p-2 bg-primary/10 rounded-lg"><Package className="text-primary w-5 h-5" /></div>
          <div><p className="text-sm text-muted-foreground">Itens Totais</p><p className="text-2xl font-display font-semibold">{insumos.length}</p></div>
        </button>
        <button
          type="button"
          onClick={handleShowInsumosEmFalta}
          className={cn(
            "bg-card border border-border rounded-xl p-5 shadow-sm flex items-center gap-3 text-left transition-colors hover:border-warning/60 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            insumoStockFilter === 'atencao' && !insumoSearch.trim() && "border-warning/60 bg-warning/10"
          )}
          aria-label="Mostrar insumos que precisam de atenção"
        >
          <div className="p-2 bg-warning/20 rounded-lg"><AlertTriangle className="text-warning w-5 h-5" /></div>
          <div><p className="text-sm text-muted-foreground">Em Falta</p><p className="text-2xl font-display font-semibold">{insumosEmFalta.length}</p></div>
        </button>
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Valor do Estoque</p>
          <p className="text-2xl font-display font-semibold mt-1">{formatCurrencyBRL(valorTotalEstoque)}</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <div className="flex flex-col gap-4 mb-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="font-display font-semibold text-lg">Compras recentes</h3>
            <p className="text-sm text-muted-foreground">Histórico das últimas entradas registradas no estoque.</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:min-w-[640px] lg:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="purchase-insumo-filter" className="text-xs text-muted-foreground">Insumo da compra</Label>
              <Select value={purchaseInsumoFilter} onValueChange={setPurchaseInsumoFilter}>
                <SelectTrigger id="purchase-insumo-filter">
                  <SelectValue placeholder="Todos os insumos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os insumos</SelectItem>
                  {insumos.map((insumo) => (
                    <SelectItem key={insumo.id} value={insumo.id}>{insumo.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="purchase-fornecedor-filter" className="text-xs text-muted-foreground">Fornecedor da compra</Label>
              <Select value={purchaseFornecedorFilter} onValueChange={setPurchaseFornecedorFilter}>
                <SelectTrigger id="purchase-fornecedor-filter">
                  <SelectValue placeholder="Todos os fornecedores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os fornecedores</SelectItem>
                  <SelectItem value="sem-fornecedor">Sem fornecedor</SelectItem>
                  {fornecedores.map((fornecedor) => (
                    <SelectItem key={fornecedor.id} value={fornecedor.id}>{fornecedor.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {hasActivePurchaseFilters && (
              <div className="flex items-end">
                <Button type="button" variant="outline" onClick={handleClearPurchaseFilters}>
                  Limpar filtros
                </Button>
              </div>
            )}
          </div>
        </div>
        {purchaseEntriesLoading ? (
          <div className="py-6 text-center text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
            Carregando compras...
          </div>
        ) : purchaseEntries.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground text-center">
            Nenhuma compra encontrada para os filtros atuais.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {purchaseEntries.map((entry) => {
              const insumo = insumosPorId.get(entry.insumo_id);
              const fornecedor = entry.fornecedor_id ? fornecedoresPorId.get(entry.fornecedor_id) : null;

              return (
                <div key={entry.id} className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 py-3">
                  <div>
                    <p className="font-medium text-foreground">{insumo?.nome || 'Insumo removido'}</p>
                    <p className="text-sm text-muted-foreground">
                      {fornecedor?.nome || 'Sem fornecedor'} • {formatLocalDate(entry.data_compra, 'dd/MM/yyyy')}
                    </p>
                  </div>
                  <div className="text-sm md:text-right">
                    <p className="font-medium text-foreground">
                      {formatInsumoQuantidade(entry.quantidade)} {entry.unidade}
                    </p>
                    <p className="text-muted-foreground">Quantidade</p>
                  </div>
                  <div className="text-sm md:text-right">
                    <p className="font-medium text-foreground">{formatCurrencyBRL(entry.valor_total)}</p>
                    <p className="text-muted-foreground">
                      {formatCurrencyBRLPrecise(entry.preco_unitario)} / {entry.unidade}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {insumos.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg text-foreground">Nenhum insumo</h3>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="font-display font-semibold text-lg">Insumos cadastrados</h3>
              <p className="text-sm text-muted-foreground">
                {filteredInsumos.length} de {insumos.length} insumo{insumos.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-[1fr_180px] lg:max-w-4xl lg:grid-cols-[1fr_180px_190px_auto]">
              <div className="relative">
                <Label htmlFor="insumos-search" className="sr-only">Buscar insumos</Label>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  id="insumos-search"
                  value={insumoSearch}
                  onChange={(event) => setInsumoSearch(event.target.value)}
                  placeholder="Buscar insumo..."
                  className="pl-10"
                />
              </div>
              <div>
                <Label htmlFor="insumos-stock-filter" className="sr-only">Filtrar insumos por status</Label>
                <Select value={insumoStockFilter} onValueChange={(value) => setInsumoStockFilter(value as InsumoStockFilter)}>
                  <SelectTrigger id="insumos-stock-filter">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="atencao">Atenção</SelectItem>
                    <SelectItem value="sem-minimo">Sem mínimo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="insumos-sort" className="sr-only">Ordenar insumos</Label>
                <Select value={insumoSort} onValueChange={(value) => setInsumoSort(value as InsumoSortOption)}>
                  <SelectTrigger id="insumos-sort">
                    <SelectValue placeholder="Ordenar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nome">Nome</SelectItem>
                    <SelectItem value="menor-saldo">Menor saldo</SelectItem>
                    <SelectItem value="maior-saldo">Maior saldo</SelectItem>
                    <SelectItem value="ultimo-custo">Último custo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {hasActiveInsumoFilters && (
                <Button type="button" variant="outline" onClick={handleClearInsumoFilters}>
                  Limpar filtros
                </Button>
              )}
            </div>
          </div>
          <div className="hidden lg:grid grid-cols-[1.5fr_0.8fr_0.8fr_1fr_auto] gap-4 border-b border-border px-5 py-3 text-sm font-medium text-muted-foreground">
            <span>Insumo</span>
            <span>Saldo</span>
            <span>Mínimo</span>
            <span>Último custo</span>
            <span className="text-right">Ações</span>
          </div>
          {filteredInsumos.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              Nenhum insumo encontrado para os filtros atuais.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {filteredInsumos.map((insumo) => {
              const stockStatus = getInsumoStockStatus(insumo.quantidade_atual, insumo.quantidade_minima);
              const stockBadge = stockStatus.needsAttention
                ? stockStatus.status === 'critical'
                  ? 'Crítico'
                  : 'Baixo'
                : null;

              return (
                <div
                  key={insumo.id}
                  className="grid grid-cols-1 gap-3 px-4 py-4 lg:grid-cols-[1.5fr_0.8fr_0.8fr_1fr_auto] lg:items-center lg:gap-4 lg:px-5 lg:py-3"
                >
                  <div className="flex min-w-0 items-center justify-between gap-3 lg:block">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-foreground">{insumo.nome}</h3>
                      <p className="text-xs text-muted-foreground lg:hidden">
                        {formatCurrencyBRL(insumo.preco_unitario || 0)} / {insumo.unidade}
                      </p>
                    </div>
                    {stockBadge && (
                      <span className={cn("shrink-0 rounded-full px-2 py-1 text-xs font-medium lg:hidden", stockStatus.status === 'critical' ? 'bg-destructive/20 text-destructive' : 'bg-warning/20 text-warning')}>
                        {stockBadge}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm lg:contents">
                    <div>
                      <p className="text-xs text-muted-foreground lg:hidden">Saldo</p>
                      <p className="font-medium text-foreground">{formatInsumoQuantidade(insumo.quantidade_atual)} {insumo.unidade}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground lg:hidden">Mínimo</p>
                      <p className="text-muted-foreground">
                        {insumo.quantidade_minima > 0
                          ? `${formatInsumoQuantidade(insumo.quantidade_minima)} ${insumo.unidade}`
                          : 'Não definido'}
                      </p>
                    </div>
                    <div className="hidden lg:block">
                      <p className="text-muted-foreground">{formatCurrencyBRL(insumo.preco_unitario || 0)} / {insumo.unidade}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 lg:justify-end">
                    <div className="flex min-w-[120px] items-center gap-2 lg:min-w-[96px]">
                      <Progress value={stockStatus.progressValue} className="h-2 flex-1" />
                      {stockBadge && (
                        <span className={cn("hidden shrink-0 rounded-full px-2 py-1 text-xs font-medium lg:inline-flex", stockStatus.status === 'critical' ? 'bg-destructive/20 text-destructive' : 'bg-warning/20 text-warning')}>
                          {stockBadge}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenDialog(insumo)}
                        aria-label={`Editar cadastro do insumo ${insumo.nome}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenEntryDialog(insumo)}
                        className="shrink-0 gap-2"
                      >
                        <ShoppingCart className="w-4 h-4" />
                        Entrada
                      </Button>
                    </div>
                  </div>
                </div>
              );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MassasTab() {
  const { massas, loading, addMassa, updateQuantidade, deleteMassa } = useEstoqueMassas();
  const { brigadeiros } = useBrigadeiros();
  const [sabor, setSabor] = useState('');
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [actionMassa, setActionMassa] = useState<EstoqueMassa | null>(null);
  const [actionType, setActionType] = useState<'add'|'sub'>('add');
  const [actionValue, setActionValue] = useState('');
  const [deleteMassaConfirm, setDeleteMassaConfirm] = useState<EstoqueMassa | null>(null);

  const saboresDisponiveis = Array.from(
    new Set(
      brigadeiros
        .filter(b => b.ativo)
        .map(b => getProdutoNomeBase(b.nome))
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b));
  const saboresCadastrados = new Set(massas.map(m => m.sabor.toLowerCase()));
  const saboresParaCadastro = saboresDisponiveis.filter(s => !saboresCadastrados.has(s.toLowerCase()));

  if (loading) return <div className="py-8 text-center text-muted-foreground"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />Carregando...</div>;

  const handleRegister = async () => {
    if (!sabor.trim()) return;
    await addMassa(sabor.trim(), 0);
    setSabor('');
    setIsRegisterOpen(false);
  };

  const handleAction = async () => {
    if (!actionMassa || !actionValue) return;
    const val = parseDecimalInput(actionValue);
    if (!Number.isFinite(val) || val <= 0) {
      toast({ title: 'Valor inválido', variant: 'destructive' });
      return;
    }
    
    const delta = actionType === 'add' ? val : -val;
    await updateQuantidade(actionMassa.id, delta);
    setActionMassa(null);
    setActionValue('');
  };

  const handleConfirmDelete = async () => {
    if (!deleteMassaConfirm) return;
    await deleteMassa(deleteMassaConfirm.id);
    setDeleteMassaConfirm(null);
  };

  const totalGeral = massas.reduce((acc, m) => acc + m.quantidade_g, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b border-border pb-4">
        <div>
           <h2 className="text-xl font-display font-semibold">Massas Base Prontas</h2>
           <p className="text-muted-foreground text-sm">Controle as massas armazenadas prontas para uso</p>
        </div>
        <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
          <DialogTrigger asChild><Button><Plus size={18} className="mr-2" /> Novo Sabor</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Registrar Novo Sabor de Massa</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="estoque-massa-sabor">Sabor da Massa</Label>
                <select
                  id="estoque-massa-sabor"
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  value={sabor}
                  onChange={(e) => setSabor(e.target.value)}
                >
                   <option value="">Selecione um produto...</option>
                   {saboresParaCadastro.map(s => (
                     <option key={s} value={s}>{s}</option>
                   ))}
                </select>
                {saboresParaCadastro.length === 0 && (
                  <p className="text-xs text-muted-foreground">Todos os produtos ativos já possuem massa cadastrada.</p>
                )}
              </div>
              <Button onClick={handleRegister} className="w-full" disabled={!sabor}>Registrar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card border border-border p-4 rounded-xl flex items-center justify-between mb-6 shadow-sm">
         <span className="text-muted-foreground font-medium">Estoque Total de Massas</span>
         <span className="text-2xl font-display font-bold">{(totalGeral / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {massas.map(massa => (
          <div key={massa.id} className="bg-card border border-border rounded-xl p-5 shadow-sm">
             <div className="flex items-start justify-between gap-2 mb-4">
               <h3 className="font-display font-semibold text-lg">{massa.sabor}</h3>
               <Button
                 variant="ghost"
                 size="icon"
                 className="text-destructive hover:text-destructive hover:bg-destructive/10"
                 onClick={() => setDeleteMassaConfirm(massa)}
                 aria-label={`Excluir massa ${massa.sabor}`}
               >
                 <Trash2 className="w-4 h-4" />
               </Button>
             </div>
             <div className="flex items-end justify-between mb-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Disponível</p>
                  <p className="text-3xl font-display font-bold text-primary">{massa.quantidade_g}g</p>
                </div>
             </div>
             <div className="grid grid-cols-2 gap-2 mt-auto">
                <Button variant="outline" className="text-success border-success/30 hover:bg-success/10 bg-success/5" onClick={() => { setActionMassa(massa); setActionType('add'); }}>
                   <ArrowUpCircle className="w-4 h-4 mr-2" /> Entrou (+g)
                </Button>
                <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10 bg-destructive/5" onClick={() => { setActionMassa(massa); setActionType('sub'); }}>
                   <ArrowDownCircle className="w-4 h-4 mr-2" /> Usou (-g)
                </Button>
             </div>
          </div>
        ))}
        {massas.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground">Nenhum sabor cadastrado. Clique em Novo Sabor para começar.</div>
        )}
      </div>

      {/* Action Dialog */}
      <Dialog open={!!actionMassa} onOpenChange={(open) => !open && setActionMassa(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{actionType === 'add' ? 'Registrar Produção de Massa' : 'Registrar Consumo de Massa'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Massa: <strong>{actionMassa?.sabor}</strong></p>
            <div className="space-y-2">
              <Label htmlFor="estoque-massa-quantidade">Quantidade (Gramas g)</Label>
              <Input id="estoque-massa-quantidade" type="text" inputMode="decimal" value={actionValue} onChange={e => setActionValue(e.target.value)} placeholder="Ex: 500,5" />
            </div>
            <Button onClick={handleAction} className="w-full" variant={actionType === 'add' ? 'default' : 'destructive'}>
              Confirmar {actionType === 'add' ? 'Entrada' : 'Saída'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteMassaConfirm} onOpenChange={(open) => !open && setDeleteMassaConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover massa base?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover {deleteMassaConfirm?.sabor} do estoque de massas base? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ProdutosTab() {
  const { produtos, loading, addProduto, updateQuantidade, deleteProduto } = useEstoqueProdutos();
  const { brigadeiros } = useBrigadeiros();
  const [brigadeiroId, setBrigadeiroId] = useState('');
  const [tamanhoProdutoFilter, setTamanhoProdutoFilter] = useState<BrigadeiroTamanhoFilter>('todos');
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [actionProduto, setActionProduto] = useState<EstoqueProduto | null>(null);
  const [actionType, setActionType] = useState<'add'|'sub'>('add');
  const [actionValue, setActionValue] = useState('');
  const [deleteProdutoConfirm, setDeleteProdutoConfirm] = useState<EstoqueProduto | null>(null);
  const brigadeirosPorId = useMemo(() => {
    return new Map(brigadeiros.map((brigadeiro) => [brigadeiro.id, brigadeiro]));
  }, [brigadeiros]);
  const produtosBrigadeiro = useMemo(() => filterProdutosBrigadeiro(brigadeiros), [brigadeiros]);

  // Filtrar quais brigadeiros ainda nao tem estoque cadastrado
  const availableBrigadeiros = useMemo(() => {
    return produtosBrigadeiro
      .filter((brigadeiro) => !produtos.some((produto) => produto.brigadeiro_id === brigadeiro.id))
      .filter((brigadeiro) => matchesBrigadeiroTamanhoFilter(brigadeiro, tamanhoProdutoFilter))
      .sort(sortByProdutoNomeETamanho);
  }, [produtosBrigadeiro, produtos, tamanhoProdutoFilter]);

  const produtosOrdenados = useMemo(() => {
    return [...produtos].sort((a, b) => sortByProdutoNomeETamanho(
      getProdutoFinalCatalogo(a, brigadeirosPorId),
      getProdutoFinalCatalogo(b, brigadeirosPorId),
    ));
  }, [produtos, brigadeirosPorId]);

  if (loading) return <div className="py-8 text-center text-muted-foreground"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />Carregando...</div>;

  const handleRegister = async () => {
    if (!brigadeiroId) return;
    const brig = availableBrigadeiros.find(b => b.id === brigadeiroId) || produtosBrigadeiro.find(b => b.id === brigadeiroId);
    await addProduto(brigadeiroId, 0, brig?.nome || 'Produto Sem Nome');
    setBrigadeiroId('');
    setTamanhoProdutoFilter('todos');
    setIsRegisterOpen(false);
  };

  const handleAction = async () => {
    if (!actionProduto || !actionValue) return;
    const val = parseIntegerInput(actionValue);
    if (!Number.isInteger(val) || val <= 0) {
      toast({ title: 'Valor inválido', variant: 'destructive' });
      return;
    }
    
    const delta = actionType === 'add' ? val : -val;
    await updateQuantidade(actionProduto.id, delta);
    setActionProduto(null);
    setActionValue('');
  };

  const handleConfirmDelete = async () => {
    if (!deleteProdutoConfirm) return;
    await deleteProduto(deleteProdutoConfirm.id);
    setDeleteProdutoConfirm(null);
  };

  const totalUnidades = produtos.reduce((acc, p) => acc + p.quantidade_un, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b border-border pb-4">
        <div>
           <h2 className="text-xl font-display font-semibold">Produtos Finais (Prontos)</h2>
           <p className="text-muted-foreground text-sm">Controle de brigadeiros já enrolados e prontos para entrega</p>
        </div>
        <Dialog open={isRegisterOpen} onOpenChange={(open) => {
          setIsRegisterOpen(open);
          if (!open) {
            setBrigadeiroId('');
            setTamanhoProdutoFilter('todos');
          }
        }}>
          <DialogTrigger asChild><Button><Plus size={18} className="mr-2" /> Novo Produto no Estoque</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Acompanhar Novo Produto</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="flex w-full sm:w-fit rounded-lg border border-border bg-muted/40 p-1">
                {BRIGADEIRO_TAMANHO_FILTERS.map((filter) => (
                  <Button
                    key={filter.value}
                    type="button"
                    size="sm"
                    variant={tamanhoProdutoFilter === filter.value ? 'default' : 'ghost'}
                    className="flex-1 sm:flex-none px-4"
                    onClick={() => {
                      setTamanhoProdutoFilter(filter.value);
                      setBrigadeiroId('');
                    }}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
              <div className="space-y-2">
                <Label htmlFor="estoque-produto-base">Produto Base</Label>
                <select id="estoque-produto-base" className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" value={brigadeiroId} onChange={e => setBrigadeiroId(e.target.value)}>
                   <option value="">Selecione um produto...</option>
                   {availableBrigadeiros.map((brigadeiro) => {
                     const tamanho = getProdutoTamanhoComercial(brigadeiro);
                     const nomeBase = getProdutoNomeBase(brigadeiro.nome);
                     const label = tamanho ? `${nomeBase} • ${tamanho}` : brigadeiro.nome;

                     return (
                       <option key={brigadeiro.id} value={brigadeiro.id}>{label}</option>
                     );
                   })}
                </select>
                {availableBrigadeiros.length === 0 && (
                  <p className="text-xs text-muted-foreground">Todos os produtos desse tamanho já estão no controle de estoque.</p>
                )}
              </div>
              <Button onClick={handleRegister} className="w-full" disabled={!brigadeiroId}>Cadastrar Produto</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card border border-border p-4 rounded-xl flex items-center justify-between mb-6 shadow-sm">
         <span className="text-muted-foreground font-medium">Estoque Total de Brigadeiros</span>
         <span className="text-2xl font-display font-bold">{totalUnidades} un</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {produtosOrdenados.map(produto => {
          const produtoCatalogo = getProdutoFinalCatalogo(produto, brigadeirosPorId);
          const produtoNome = produtoCatalogo.nome;
          const produtoBase = getProdutoNomeBase(produtoNome);
          const produtoTamanho = getProdutoTamanhoComercial(produtoCatalogo);

          return (
          <div key={produto.id} className="bg-card border border-border rounded-xl p-5 shadow-sm">
             <div className="flex items-start justify-between gap-2 mb-4">
               <div className="space-y-2">
                 {produtoTamanho && (
                   <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                     {produtoTamanho}
                   </span>
                 )}
                 <h3 className="font-display font-semibold text-lg">{produtoBase}</h3>
               </div>
               <Button
                 variant="ghost"
                 size="icon"
                 className="text-destructive hover:text-destructive hover:bg-destructive/10"
                 onClick={() => setDeleteProdutoConfirm(produto)}
                 aria-label={`Excluir produto ${produto.brigadeiro?.nome || ''}`}
               >
                 <Trash2 className="w-4 h-4" />
               </Button>
             </div>
             <div className="flex items-end justify-between mb-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Disponível</p>
                  <p className="text-3xl font-display font-bold text-primary">{produto.quantidade_un} un</p>
                </div>
             </div>
             <div className="grid grid-cols-2 gap-2 mt-auto">
                <Button variant="outline" className="text-success border-success/30 hover:bg-success/10 bg-success/5" onClick={() => { setActionProduto(produto); setActionType('add'); }}>
                   <ArrowUpCircle className="w-4 h-4 mr-2" /> Enrolado (+un)
                </Button>
                <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10 bg-destructive/5" onClick={() => { setActionProduto(produto); setActionType('sub'); }}>
                   <ArrowDownCircle className="w-4 h-4 mr-2" /> Saída (-un)
                </Button>
             </div>
          </div>
          );
        })}
        {produtos.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground">Nenhum produto cadastrado no controle. Clique em Novo Produto para começar.</div>
        )}
      </div>

      {/* Action Dialog */}
      <Dialog open={!!actionProduto} onOpenChange={(open) => !open && setActionProduto(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{actionType === 'add' ? 'Registrar Produção Pronta' : 'Registrar Saída de Produto'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Produto: <strong>{actionProduto?.brigadeiro?.nome}</strong></p>
            <div className="space-y-2">
              <Label htmlFor="estoque-produto-quantidade">Quantidade (Unidades)</Label>
              <Input id="estoque-produto-quantidade" type="number" min="1" step="1" value={actionValue} onChange={e => setActionValue(e.target.value)} placeholder="Ex: 50" />
            </div>
            <Button onClick={handleAction} className="w-full" variant={actionType === 'add' ? 'default' : 'destructive'}>
              Confirmar {actionType === 'add' ? 'Entrada' : 'Saída'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteProdutoConfirm} onOpenChange={(open) => !open && setDeleteProdutoConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover produto final?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover {deleteProdutoConfirm?.brigadeiro?.nome || 'este produto'} do estoque de produtos finais? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function EstoquePage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-foreground">Gestão de Estoques</h1>
          <p className="text-muted-foreground mt-1">Controle integrado de insumos, massas base e produtos finais</p>
        </div>
      </div>

      <Tabs defaultValue="insumos" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-2xl mb-8 border border-border shadow-sm p-1 rounded-lg">
          <TabsTrigger value="insumos" className="rounded-md">Raw/Insumos</TabsTrigger>
          <TabsTrigger value="massas" className="rounded-md">Massas Base (g)</TabsTrigger>
          <TabsTrigger value="produtos" className="rounded-md">Produtos Finais (un)</TabsTrigger>
        </TabsList>
        <div className="mt-4">
            <TabsContent value="insumos" className="mt-0 outline-none"><InsumosTab /></TabsContent>
            <TabsContent value="massas" className="mt-0 outline-none"><MassasTab /></TabsContent>
            <TabsContent value="produtos" className="mt-0 outline-none"><ProdutosTab /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
