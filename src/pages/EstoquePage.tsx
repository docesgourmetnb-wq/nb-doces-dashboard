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
import { Textarea } from '@/components/ui/textarea';
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
  getProdutoNomeComercial,
  getProdutoTamanhoComercial,
  matchesBrigadeiroTamanhoFilter,
  summarizeEstoqueProdutosFinais,
  type ProdutoCategoriaInput,
} from '@/domain/produtos';
import { parseDecimalInput, parseIntegerInput } from '@/domain/numeros';
import {
  calculateInsumoPackageEquivalent,
  calculateInsumoExit,
  calculateInsumoPurchaseQuantity,
  formatInsumoCurrentStockPackageReference,
  formatInsumoPackageReference,
  getInsumoEntryModePadrao,
  getInsumoStockStatus,
  summarizeKnownInsumoStockValue,
} from '@/domain/estoque';
import {
  INSUMO_UNIDADES,
  INSUMO_TIPOS_ESTOQUE,
  getInsumoTipoEstoqueLabel,
  getInsumoQuantidadePlaceholder,
  getInsumoUnidadePadraoPorTipo,
  getInsumoUnidadeLabel,
  isInsumoUnidadePadrao,
  isInsumoTipoEstoque,
  type InsumoTipoEstoque,
} from '@/domain/insumos';

type InsumoFormErrors = Partial<Record<
  'nome' | 'unidade' | 'quantidade_minima' | 'tipo_estoque',
  string
>>;

type InsumoEntryErrors = Partial<Record<
  'quantidade_embalagens' | 'conteudo_por_embalagem' | 'quantidade_total' | 'valor_total' | 'data_compra',
  string
>>;

type InsumoExitErrors = Partial<Record<'quantidade_embalagens' | 'conteudo_por_embalagem' | 'quantidade_total' | 'motivo', string>>;

type InsumoEntryMode = 'embalagens' | 'quantidade';
type InsumoStockFilter = 'todos' | 'atencao' | 'sem-minimo';
type InsumoSortOption = 'nome' | 'menor-saldo' | 'maior-saldo' | 'ultimo-custo';
type InsumoTipoFilter = 'todos' | InsumoTipoEstoque;
type InsumoPaymentOriginFilter = 'todos' | 'sem_valor' | 'caixa' | 'fora_caixa';

function getTamanhoSortValue(tamanho: string | null) {
  return Number(tamanho?.replace(',', '.').replace(/g$/i, '') ?? Number.POSITIVE_INFINITY);
}

function formatInsumoQuantidade(value: number) {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

function formatInsumoQuantidadeCompacta(value: number) {
  return value.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

function formatCurrencyBRLPrecise(value: number) {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}

function getInsumoEntryPaymentOriginLabel(origem: string | null | undefined) {
  if (origem === 'caixa') return 'Caixa da empresa';
  if (origem === 'fora_caixa') return 'Fora do caixa';
  return 'Sem valor';
}

function sortByProdutoNomeETamanho<T extends ProdutoCategoriaInput>(a: T, b: T) {
  const nomeBaseCompare = getProdutoNomeComercial(a).localeCompare(getProdutoNomeComercial(b), 'pt-BR');
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
  const { insumos, loading, addInsumo, updateInsumo, registerInsumoEntry, registerInsumoManualExit } = useInsumos();
  const { fornecedores } = useFornecedores();
  const [purchaseInsumoFilter, setPurchaseInsumoFilter] = useState('todos');
  const [purchaseTipoFilter, setPurchaseTipoFilter] = useState<InsumoTipoFilter>('todos');
  const [purchaseFornecedorFilter, setPurchaseFornecedorFilter] = useState('todos');
  const [purchasePaymentOriginFilter, setPurchasePaymentOriginFilter] = useState<InsumoPaymentOriginFilter>('todos');
  const [insumoSearch, setInsumoSearch] = useState('');
  const [insumoStockFilter, setInsumoStockFilter] = useState<InsumoStockFilter>('todos');
  const [insumoTipoFilter, setInsumoTipoFilter] = useState<InsumoTipoFilter>('todos');
  const [insumoSort, setInsumoSort] = useState<InsumoSortOption>('nome');
  const { entries: stockReferenceEntries, refetch: refetchStockReferenceEntries } = useInsumoPurchaseEntries({ limit: 1000 });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [exitDialogOpen, setExitDialogOpen] = useState(false);
  const [editingInsumo, setEditingInsumo] = useState<Insumo | null>(null);
  const [entryInsumo, setEntryInsumo] = useState<Insumo | null>(null);
  const [exitInsumo, setExitInsumo] = useState<Insumo | null>(null);
  const [saving, setSaving] = useState(false);
  const [entrySaving, setEntrySaving] = useState(false);
  const [exitSaving, setExitSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<InsumoFormErrors>({});
  const [entryErrors, setEntryErrors] = useState<InsumoEntryErrors>({});
  const [exitErrors, setExitErrors] = useState<InsumoExitErrors>({});
  const [entryMode, setEntryMode] = useState<InsumoEntryMode>('embalagens');
  const [exitMode, setExitMode] = useState<InsumoEntryMode>('embalagens');
  const [formData, setFormData] = useState({
    nome: '',
    unidade: 'g',
    tipo_estoque: 'producao' as InsumoTipoEstoque,
    quantidade_minima: '',
  });
  const [entryFormData, setEntryFormData] = useState({
    quantidade_embalagens: '',
    conteudo_por_embalagem: '',
    quantidade_total: '',
    valor_total: '',
    origem_pagamento: 'fora_caixa',
    data_compra: '',
    fornecedor_id: 'sem-fornecedor',
  });
  const [exitFormData, setExitFormData] = useState({
    quantidade_embalagens: '',
    conteudo_por_embalagem: '',
    quantidade_total: '',
    motivo: '',
  });
  const fornecedoresAtivos = fornecedores.filter((fornecedor) => fornecedor.ativo);
  const insumosPorId = useMemo(() => new Map(insumos.map((insumo) => [insumo.id, insumo])), [insumos]);
  const fornecedoresPorId = useMemo(() => new Map(fornecedores.map((fornecedor) => [fornecedor.id, fornecedor])), [fornecedores]);
  const purchaseFilterInsumos = useMemo(
    () => insumos.filter((insumo) => purchaseTipoFilter === 'todos' || (insumo.tipo_estoque ?? 'producao') === purchaseTipoFilter),
    [insumos, purchaseTipoFilter],
  );
  const purchaseTipoInsumoIds = useMemo(
    () => (purchaseTipoFilter === 'todos' ? undefined : purchaseFilterInsumos.map((insumo) => insumo.id)),
    [purchaseFilterInsumos, purchaseTipoFilter],
  );
  const { entries: purchaseEntries, loading: purchaseEntriesLoading, refetch: refetchPurchaseEntries } = useInsumoPurchaseEntries({
    fornecedorId: purchaseFornecedorFilter,
    insumoId: purchaseInsumoFilter,
    insumoIds: purchaseInsumoFilter === 'todos' ? purchaseTipoInsumoIds : undefined,
    origemPagamento: purchasePaymentOriginFilter,
  });
  const stockReferenceByInsumoId = useMemo(() => {
    const references = new Map<string, { quantidade_embalagens: number | null; conteudo_por_embalagem: number }>();

    stockReferenceEntries.forEach((entry) => {
      if (!entry.conteudo_por_embalagem || references.has(entry.insumo_id)) return;
      references.set(entry.insumo_id, {
        quantidade_embalagens: entry.quantidade_embalagens,
        conteudo_por_embalagem: entry.conteudo_por_embalagem,
      });
    });

    return references;
  }, [stockReferenceEntries]);
  const knownUnitCostByInsumoId = useMemo(() => {
    const costs = new Map<string, number>();

    stockReferenceEntries.forEach((entry) => {
      if (costs.has(entry.insumo_id) || entry.valor_total <= 0 || entry.preco_unitario <= 0) return;
      costs.set(entry.insumo_id, entry.preco_unitario);
    });

    return costs;
  }, [stockReferenceEntries]);
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
      const tipoEstoque = insumo.tipo_estoque ?? 'producao';
      const matchesTipoFilter = insumoTipoFilter === 'todos' || tipoEstoque === insumoTipoFilter;

      return matchesSearch && matchesStockFilter && matchesTipoFilter;
    });

    return [...filtered].sort((a, b) => {
      if (insumoSort === 'menor-saldo') {
        return a.quantidade_atual - b.quantidade_atual || a.nome.localeCompare(b.nome, 'pt-BR');
      }

      if (insumoSort === 'maior-saldo') {
        return b.quantidade_atual - a.quantidade_atual || a.nome.localeCompare(b.nome, 'pt-BR');
      }

      if (insumoSort === 'ultimo-custo') {
        return (knownUnitCostByInsumoId.get(b.id) ?? 0) - (knownUnitCostByInsumoId.get(a.id) ?? 0)
          || a.nome.localeCompare(b.nome, 'pt-BR');
      }

      return a.nome.localeCompare(b.nome, 'pt-BR');
    });
  }, [insumoSearch, insumoSort, insumoStockFilter, insumoTipoFilter, insumos, knownUnitCostByInsumoId]);

  const insumosEmFalta = insumos.filter(i => getInsumoStockStatus(i.quantidade_atual, i.quantidade_minima).needsAttention);
  const totalInsumosProducao = insumos.filter((insumo) => (insumo.tipo_estoque ?? 'producao') === 'producao').length;
  const totalEmbalagens = insumos.filter((insumo) => insumo.tipo_estoque === 'embalagem').length;
  const stockValueSummary = useMemo(() => summarizeKnownInsumoStockValue(
    insumos.map((insumo) => ({
      id: insumo.id,
      quantidadeAtual: insumo.quantidade_atual,
    })),
    stockReferenceEntries.map((entry) => ({
      insumoId: entry.insumo_id,
      quantidade: entry.quantidade,
      valorTotal: entry.valor_total,
    })),
  ), [insumos, stockReferenceEntries]);
  const valorConhecidoEstoque = stockValueSummary.valorConhecido;
  const hasSaldoSemCusto = stockValueSummary.insumosComSaldoSemCusto > 0;
  const hasActivePurchaseFilters = purchaseInsumoFilter !== 'todos'
    || purchaseTipoFilter !== 'todos'
    || purchaseFornecedorFilter !== 'todos'
    || purchasePaymentOriginFilter !== 'todos';
  const hasActiveInsumoFilters = !!insumoSearch.trim() || insumoStockFilter !== 'todos' || insumoTipoFilter !== 'todos' || insumoSort !== 'nome';

  const handleClearPurchaseFilters = () => {
    setPurchaseInsumoFilter('todos');
    setPurchaseTipoFilter('todos');
    setPurchaseFornecedorFilter('todos');
    setPurchasePaymentOriginFilter('todos');
  };

  const handleClearInsumoFilters = () => {
    setInsumoSearch('');
    setInsumoStockFilter('todos');
    setInsumoTipoFilter('todos');
    setInsumoSort('nome');
  };

  const handleShowAllInsumos = () => {
    handleClearInsumoFilters();
  };

  const handleShowInsumosEmFalta = () => {
    setInsumoSearch('');
    setInsumoStockFilter('atencao');
    setInsumoTipoFilter('todos');
  };

  const handleOpenDialog = (insumo?: Insumo) => {
    if (insumo) {
      setEditingInsumo(insumo);
      setFormData({
        nome: insumo.nome,
        unidade: insumo.unidade,
        tipo_estoque: insumo.tipo_estoque ?? 'producao',
        quantidade_minima: insumo.quantidade_minima.toString(),
      });
    } else {
      setEditingInsumo(null);
      setFormData({
        nome: '',
        unidade: 'g',
        tipo_estoque: 'producao',
        quantidade_minima: '',
      });
    }
    setFormErrors({});
    setIsDialogOpen(true);
  };

  const handleOpenEntryDialog = (insumo: Insumo) => {
    setEntryInsumo(insumo);
    setEntryMode(getInsumoEntryModePadrao(insumo.unidade));
    setEntryFormData({
      quantidade_embalagens: '',
      conteudo_por_embalagem: '',
      quantidade_total: '',
      valor_total: '',
      origem_pagamento: 'fora_caixa',
      data_compra: '',
      fornecedor_id: 'sem-fornecedor',
    });
    setEntryErrors({});
    setEntryDialogOpen(true);
  };

  const handleOpenExitDialog = (insumo: Insumo) => {
    const stockReference = stockReferenceByInsumoId.get(insumo.id);

    setExitInsumo(insumo);
    setExitMode(stockReference?.conteudo_por_embalagem ? 'embalagens' : getInsumoEntryModePadrao(insumo.unidade));
    setExitFormData({
      quantidade_embalagens: '',
      conteudo_por_embalagem: stockReference?.conteudo_por_embalagem
        ? stockReference.conteudo_por_embalagem.toString()
        : '',
      quantidade_total: '',
      motivo: '',
    });
    setExitErrors({});
    setExitDialogOpen(true);
  };

  const handleSave = async () => {
    const quantidadeMinima = formData.quantidade_minima.trim() ? parseDecimalInput(formData.quantidade_minima) : 0;
    const errors: InsumoFormErrors = {};

    if (!formData.nome.trim()) errors.nome = 'Informe o nome do item';
    if (!formData.unidade.trim()) errors.unidade = 'Informe a unidade';
    if (!isInsumoTipoEstoque(formData.tipo_estoque)) errors.tipo_estoque = 'Selecione o tipo de item';
    if (!Number.isFinite(quantidadeMinima) || quantidadeMinima < 0) errors.quantidade_minima = 'Informe uma quantidade mínima válida';

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      if (editingInsumo) {
        await updateInsumo(editingInsumo.id, {
          nome: formData.nome.trim(),
          unidade: formData.unidade,
          tipo_estoque: formData.tipo_estoque,
          quantidade_minima: quantidadeMinima,
        });
      } else {
        await addInsumo({
          nome: formData.nome.trim(),
          unidade: formData.unidade,
          tipo_estoque: formData.tipo_estoque,
          quantidade_minima: quantidadeMinima,
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
    const quantidadeTotal = parseDecimalInput(entryFormData.quantidade_total);
    const valorTotalEntrada = entryFormData.valor_total.trim() ? parseDecimalInput(entryFormData.valor_total) : 0;
    const errors: InsumoEntryErrors = {};
    let quantidadeEntrada = 0;
    let quantidadeEmbalagensRegistro: number | null = null;
    let conteudoPorEmbalagemRegistro: number | null = null;

    if (entryMode === 'embalagens') {
      if (!Number.isFinite(quantidadeEmbalagens) || quantidadeEmbalagens <= 0) {
        errors.quantidade_embalagens = 'Informe uma quantidade maior que zero';
      }
      if (!Number.isFinite(conteudoPorEmbalagem) || conteudoPorEmbalagem <= 0) {
        errors.conteudo_por_embalagem = 'Informe o conteúdo por embalagem';
      }

      if (Object.keys(errors).length === 0) {
        quantidadeEntrada = calculateInsumoPurchaseQuantity(quantidadeEmbalagens, conteudoPorEmbalagem);
        quantidadeEmbalagensRegistro = quantidadeEmbalagens;
        conteudoPorEmbalagemRegistro = conteudoPorEmbalagem;
      }
    } else {
      if (!Number.isFinite(quantidadeTotal) || quantidadeTotal <= 0) {
        errors.quantidade_total = 'Informe uma quantidade maior que zero';
      }

      if (entryFormData.conteudo_por_embalagem.trim()) {
        if (!Number.isFinite(conteudoPorEmbalagem) || conteudoPorEmbalagem <= 0) {
          errors.conteudo_por_embalagem = 'Informe uma referência de embalagem válida';
        } else {
          conteudoPorEmbalagemRegistro = conteudoPorEmbalagem;
        }
      }

      if (Object.keys(errors).length === 0) {
        quantidadeEntrada = quantidadeTotal;
        quantidadeEmbalagensRegistro = conteudoPorEmbalagemRegistro
          ? calculateInsumoPackageEquivalent(quantidadeTotal, conteudoPorEmbalagemRegistro)
          : null;
      }
    }

    if (!Number.isFinite(valorTotalEntrada) || valorTotalEntrada < 0) {
      errors.valor_total = 'Informe um valor total válido';
    }
    setEntryErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setEntrySaving(true);
    try {
      const updatedInsumo = await registerInsumoEntry(
        entryInsumo.id,
        quantidadeEntrada,
        valorTotalEntrada,
        entryFormData.data_compra || null,
        entryFormData.fornecedor_id === 'sem-fornecedor' ? null : entryFormData.fornecedor_id,
        quantidadeEmbalagensRegistro,
        conteudoPorEmbalagemRegistro,
        entryFormData.origem_pagamento === 'caixa',
      );
      if (updatedInsumo) {
        await Promise.all([refetchPurchaseEntries(), refetchStockReferenceEntries()]);
        setEntryDialogOpen(false);
      }
    } finally {
      setEntrySaving(false);
    }
  };

  const handleSaveExit = async () => {
    if (!exitInsumo) return;

    const quantidadeEmbalagens = parseDecimalInput(exitFormData.quantidade_embalagens);
    const conteudoPorEmbalagem = parseDecimalInput(exitFormData.conteudo_por_embalagem);
    const quantidadeTotal = parseDecimalInput(exitFormData.quantidade_total);
    const errors: InsumoExitErrors = {};
    let quantidadeSaida = 0;

    if (exitMode === 'embalagens') {
      if (!Number.isFinite(quantidadeEmbalagens) || quantidadeEmbalagens <= 0) {
        errors.quantidade_embalagens = 'Informe uma quantidade maior que zero';
      }
      if (!Number.isFinite(conteudoPorEmbalagem) || conteudoPorEmbalagem <= 0) {
        errors.conteudo_por_embalagem = 'Informe o conteúdo por embalagem';
      }

      if (Object.keys(errors).length === 0) {
        quantidadeSaida = calculateInsumoPurchaseQuantity(quantidadeEmbalagens, conteudoPorEmbalagem);
      }
    } else {
      if (!Number.isFinite(quantidadeTotal) || quantidadeTotal <= 0) {
        errors.quantidade_total = 'Informe uma quantidade maior que zero';
      }

      if (Object.keys(errors).length === 0) {
        quantidadeSaida = quantidadeTotal;
      }
    }

    if (Object.keys(errors).length === 0) {
      try {
        calculateInsumoExit(exitInsumo.quantidade_atual, quantidadeSaida);
      } catch {
        const errorKey = exitMode === 'embalagens' ? 'quantidade_embalagens' : 'quantidade_total';
        errors[errorKey] = `Saldo insuficiente. Disponível: ${formatInsumoQuantidade(exitInsumo.quantidade_atual)} ${exitInsumo.unidade}`;
      }
    }

    setExitErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setExitSaving(true);
    try {
      const updatedInsumo = await registerInsumoManualExit(
        exitInsumo.id,
        quantidadeSaida,
        exitFormData.motivo.trim() || null,
      );
      if (updatedInsumo) {
        await Promise.all([refetchPurchaseEntries(), refetchStockReferenceEntries()]);
        setExitDialogOpen(false);
      }
    } finally {
      setExitSaving(false);
    }
  };

  const previewQuantidadeEmbalagens = parseDecimalInput(entryFormData.quantidade_embalagens);
  const previewConteudoPorEmbalagem = parseDecimalInput(entryFormData.conteudo_por_embalagem);
  const previewQuantidadeAvulsa = parseDecimalInput(entryFormData.quantidade_total);
  const previewQuantidadeTotal = entryMode === 'embalagens'
    ? Number.isFinite(previewQuantidadeEmbalagens)
      && previewQuantidadeEmbalagens > 0
      && Number.isFinite(previewConteudoPorEmbalagem)
      && previewConteudoPorEmbalagem > 0
        ? calculateInsumoPurchaseQuantity(previewQuantidadeEmbalagens, previewConteudoPorEmbalagem)
        : null
    : Number.isFinite(previewQuantidadeAvulsa) && previewQuantidadeAvulsa > 0
      ? previewQuantidadeAvulsa
      : null;
  const previewEmbalagemEquivalente = entryMode === 'quantidade'
    && previewQuantidadeTotal !== null
    && Number.isFinite(previewConteudoPorEmbalagem)
    && previewConteudoPorEmbalagem > 0
      ? calculateInsumoPackageEquivalent(previewQuantidadeTotal, previewConteudoPorEmbalagem)
      : null;
  const previewExitQuantidadeEmbalagens = parseDecimalInput(exitFormData.quantidade_embalagens);
  const previewExitConteudoPorEmbalagem = parseDecimalInput(exitFormData.conteudo_por_embalagem);
  const previewExitQuantidadeAvulsa = parseDecimalInput(exitFormData.quantidade_total);
  const previewExitQuantidadeTotal = exitMode === 'embalagens'
    ? Number.isFinite(previewExitQuantidadeEmbalagens)
      && previewExitQuantidadeEmbalagens > 0
      && Number.isFinite(previewExitConteudoPorEmbalagem)
      && previewExitConteudoPorEmbalagem > 0
        ? calculateInsumoPurchaseQuantity(previewExitQuantidadeEmbalagens, previewExitConteudoPorEmbalagem)
        : null
    : Number.isFinite(previewExitQuantidadeAvulsa) && previewExitQuantidadeAvulsa > 0
      ? previewExitQuantidadeAvulsa
      : null;

  if (loading) return <div className="py-8 text-center text-muted-foreground"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />Carregando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-display font-semibold">Tabela de Itens</h2>
        <Button onClick={() => handleOpenDialog()} className="gap-2">
          <Plus size={18} /> Novo Item
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">
                {editingInsumo ? 'Editar Item' : 'Novo Item'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="insumo-nome">Nome</Label>
                  <Input id="insumo-nome" value={formData.nome} onChange={(e) => {
                    setFormData({ ...formData, nome: e.target.value });
                    if (formErrors.nome) setFormErrors({ ...formErrors, nome: '' });
                  }} placeholder="Ex: Leite Condensado, Pelotine, Fita" aria-invalid={!!formErrors.nome} aria-describedby={formErrors.nome ? 'insumo-nome-error' : undefined} />
                  {formErrors.nome && <p id="insumo-nome-error" className="text-xs text-destructive">{formErrors.nome}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="insumo-tipo">Tipo</Label>
                  <Select
                    value={formData.tipo_estoque}
                    onValueChange={(value) => {
                      const tipoEstoque = value as InsumoTipoEstoque;
                      setFormData({
                        ...formData,
                        tipo_estoque: tipoEstoque,
                        unidade: getInsumoUnidadePadraoPorTipo(tipoEstoque),
                      });
                      if (formErrors.tipo_estoque || formErrors.unidade) {
                        setFormErrors({ ...formErrors, tipo_estoque: '', unidade: '' });
                      }
                    }}
                  >
                    <SelectTrigger
                      id="insumo-tipo"
                      aria-invalid={!!formErrors.tipo_estoque}
                      aria-describedby={formErrors.tipo_estoque ? 'insumo-tipo-error' : undefined}
                    >
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {INSUMO_TIPOS_ESTOQUE.map((tipo) => (
                        <SelectItem key={tipo.value} value={tipo.value}>
                          {tipo.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {formErrors.tipo_estoque && <p id="insumo-tipo-error" className="text-xs text-destructive">{formErrors.tipo_estoque}</p>}
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
                {editingInsumo ? 'Salvar Alterações' : 'Adicionar Item'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

      <Dialog open={entryDialogOpen} onOpenChange={setEntryDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Registrar entrada</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Item: <strong className="text-foreground">{entryInsumo?.nome}</strong>
              {entryInsumo && (
                <span> • controle em {getInsumoUnidadeLabel(entryInsumo.unidade)}</span>
              )}
            </p>
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
              <Button
                type="button"
                variant={entryMode === 'embalagens' ? 'default' : 'ghost'}
                onClick={() => {
                  setEntryMode('embalagens');
                  setEntryErrors({});
                }}
              >
                Por embalagem
              </Button>
              <Button
                type="button"
                variant={entryMode === 'quantidade' ? 'default' : 'ghost'}
                onClick={() => {
                  setEntryMode('quantidade');
                  setEntryErrors({});
                }}
              >
                Quantidade avulsa
              </Button>
            </div>

            {entryMode === 'embalagens' ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[0.9fr_1.1fr]">
                <div className="space-y-2">
                  <Label htmlFor="insumo-entry-quantidade-embalagens">Quantidade de embalagens</Label>
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
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="insumo-entry-quantidade-total">Quantidade disponível ({entryInsumo?.unidade || 'unidade'})</Label>
                  <Input
                    id="insumo-entry-quantidade-total"
                    type="text"
                    inputMode="decimal"
                    value={entryFormData.quantidade_total}
                    onChange={(e) => {
                      setEntryFormData({ ...entryFormData, quantidade_total: e.target.value });
                      if (entryErrors.quantidade_total) setEntryErrors({ ...entryErrors, quantidade_total: '' });
                    }}
                    placeholder={getInsumoQuantidadePlaceholder(entryInsumo?.unidade || '')}
                    aria-invalid={!!entryErrors.quantidade_total}
                    aria-describedby={entryErrors.quantidade_total ? 'insumo-entry-quantidade-total-error' : undefined}
                  />
                  {entryErrors.quantidade_total && <p id="insumo-entry-quantidade-total-error" className="text-xs text-destructive">{entryErrors.quantidade_total}</p>}
                  <p className="text-xs text-muted-foreground">
                    Para potes abertos ou sobras.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="insumo-entry-conteudo-avulso">Referência da embalagem ({entryInsumo?.unidade || 'unidade'})</Label>
                  <Input
                    id="insumo-entry-conteudo-avulso"
                    type="text"
                    inputMode="decimal"
                    value={entryFormData.conteudo_por_embalagem}
                    onChange={(e) => {
                      setEntryFormData({ ...entryFormData, conteudo_por_embalagem: e.target.value });
                      if (entryErrors.conteudo_por_embalagem) setEntryErrors({ ...entryErrors, conteudo_por_embalagem: '' });
                    }}
                    placeholder="Opcional. Ex: 1000"
                    aria-invalid={!!entryErrors.conteudo_por_embalagem}
                    aria-describedby={entryErrors.conteudo_por_embalagem ? 'insumo-entry-conteudo-avulso-error' : undefined}
                  />
                  {entryErrors.conteudo_por_embalagem && <p id="insumo-entry-conteudo-avulso-error" className="text-xs text-destructive">{entryErrors.conteudo_por_embalagem}</p>}
                  <p className="text-xs text-muted-foreground">
                    Só para equivalência visual.
                  </p>
                </div>
              </div>
            )}
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              Total a adicionar:{' '}
              <strong className="text-foreground">
                {previewQuantidadeTotal === null || !entryInsumo
                  ? '-'
                  : `${formatInsumoQuantidade(previewQuantidadeTotal)} ${entryInsumo.unidade}`}
              </strong>
              {previewEmbalagemEquivalente !== null && (
                <span>
                  {' '}• ≈ {formatInsumoQuantidadeCompacta(previewEmbalagemEquivalente)} embalagem
                  {previewEmbalagemEquivalente === 1 ? '' : 's'} de {formatInsumoQuantidade(previewConteudoPorEmbalagem)} {entryInsumo?.unidade}
                </span>
              )}
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
                <p className="text-xs text-muted-foreground">
                  Informe quando quiser guardar custo real do estoque.
                </p>
              </div>
              {entryFormData.valor_total.trim() && parseDecimalInput(entryFormData.valor_total) > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="insumo-entry-origem-pagamento">Origem do pagamento</Label>
                  <Select
                    value={entryFormData.origem_pagamento}
                    onValueChange={(value) => setEntryFormData({ ...entryFormData, origem_pagamento: value })}
                  >
                    <SelectTrigger id="insumo-entry-origem-pagamento">
                      <SelectValue placeholder="Selecione a origem" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fora_caixa">Fora do caixa</SelectItem>
                      <SelectItem value="caixa">Caixa da empresa</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Fora do caixa valoriza o estoque, mas não registra despesa no Financeiro.
                  </p>
                </div>
              )}
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
              <p className="text-xs text-muted-foreground">
                Opcional. Deixe em branco para estoque antigo ou quando a data real da compra não for conhecida.
              </p>
            </div>
            <Button onClick={handleSaveEntry} className="w-full" disabled={entrySaving}>
              {entrySaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShoppingCart className="w-4 h-4 mr-2" />}
              Registrar entrada
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={exitDialogOpen} onOpenChange={setExitDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Registrar saída</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Item: <strong className="text-foreground">{exitInsumo?.nome}</strong>
              {exitInsumo && (
                <span> • saldo atual: {formatInsumoQuantidade(exitInsumo.quantidade_atual)} {exitInsumo.unidade}</span>
              )}
            </p>
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
              <Button
                type="button"
                variant={exitMode === 'embalagens' ? 'default' : 'ghost'}
                onClick={() => {
                  setExitMode('embalagens');
                  setExitErrors({});
                }}
              >
                Por embalagem
              </Button>
              <Button
                type="button"
                variant={exitMode === 'quantidade' ? 'default' : 'ghost'}
                onClick={() => {
                  setExitMode('quantidade');
                  setExitErrors({});
                }}
              >
                Quantidade avulsa
              </Button>
            </div>

            {exitMode === 'embalagens' ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[0.9fr_1.1fr]">
                <div className="space-y-2">
                  <Label htmlFor="insumo-exit-quantidade-embalagens">Quantidade de embalagens</Label>
                  <Input
                    id="insumo-exit-quantidade-embalagens"
                    type="text"
                    inputMode="decimal"
                    value={exitFormData.quantidade_embalagens}
                    onChange={(event) => {
                      setExitFormData({ ...exitFormData, quantidade_embalagens: event.target.value });
                      if (exitErrors.quantidade_embalagens) setExitErrors({ ...exitErrors, quantidade_embalagens: '' });
                    }}
                    placeholder="Ex: 1"
                    aria-invalid={!!exitErrors.quantidade_embalagens}
                    aria-describedby={exitErrors.quantidade_embalagens ? 'insumo-exit-quantidade-embalagens-error' : undefined}
                  />
                  {exitErrors.quantidade_embalagens && <p id="insumo-exit-quantidade-embalagens-error" className="text-xs text-destructive">{exitErrors.quantidade_embalagens}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="insumo-exit-conteudo">Conteúdo por embalagem ({exitInsumo?.unidade || 'unidade'})</Label>
                  <Input
                    id="insumo-exit-conteudo"
                    type="text"
                    inputMode="decimal"
                    value={exitFormData.conteudo_por_embalagem}
                    onChange={(event) => {
                      setExitFormData({ ...exitFormData, conteudo_por_embalagem: event.target.value });
                      if (exitErrors.conteudo_por_embalagem) setExitErrors({ ...exitErrors, conteudo_por_embalagem: '' });
                    }}
                    placeholder={getInsumoQuantidadePlaceholder(exitInsumo?.unidade || '')}
                    aria-invalid={!!exitErrors.conteudo_por_embalagem}
                    aria-describedby={exitErrors.conteudo_por_embalagem ? 'insumo-exit-conteudo-error' : undefined}
                  />
                  {exitErrors.conteudo_por_embalagem && <p id="insumo-exit-conteudo-error" className="text-xs text-destructive">{exitErrors.conteudo_por_embalagem}</p>}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="insumo-exit-quantidade-total">Quantidade a baixar ({exitInsumo?.unidade || 'unidade'})</Label>
                <Input
                  id="insumo-exit-quantidade-total"
                  type="text"
                  inputMode="decimal"
                  value={exitFormData.quantidade_total}
                  onChange={(event) => {
                    setExitFormData({ ...exitFormData, quantidade_total: event.target.value });
                    if (exitErrors.quantidade_total) setExitErrors({ ...exitErrors, quantidade_total: '' });
                  }}
                  placeholder={getInsumoQuantidadePlaceholder(exitInsumo?.unidade || '')}
                  aria-invalid={!!exitErrors.quantidade_total}
                  aria-describedby={exitErrors.quantidade_total ? 'insumo-exit-quantidade-total-error' : undefined}
                />
                {exitErrors.quantidade_total && <p id="insumo-exit-quantidade-total-error" className="text-xs text-destructive">{exitErrors.quantidade_total}</p>}
              </div>
            )}
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              Total a baixar:{' '}
              <strong className="text-foreground">
                {previewExitQuantidadeTotal === null || !exitInsumo
                  ? '-'
                  : `${formatInsumoQuantidade(previewExitQuantidadeTotal)} ${exitInsumo.unidade}`}
              </strong>
            </div>
            <div className="space-y-2">
              <Label htmlFor="insumo-exit-motivo">Motivo</Label>
              <Textarea
                id="insumo-exit-motivo"
                value={exitFormData.motivo}
                onChange={(event) => setExitFormData({ ...exitFormData, motivo: event.target.value })}
                placeholder="Ex: Usado para enrolar massa de paçoca"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                Opcional. Use para lembrar se foi produção, teste, perda ou ajuste manual.
              </p>
            </div>
            <Button onClick={handleSaveExit} className="w-full" disabled={exitSaving}>
              {exitSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowDownCircle className="w-4 h-4 mr-2" />}
              Registrar saída
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
            insumoStockFilter === 'todos' && insumoTipoFilter === 'todos' && !insumoSearch.trim() && "border-primary/50 bg-primary/5"
          )}
          aria-label="Mostrar todos os itens cadastrados"
        >
          <div className="p-2 bg-primary/10 rounded-lg"><Package className="text-primary w-5 h-5" /></div>
          <div>
            <p className="text-sm text-muted-foreground">Itens Totais</p>
            <p className="text-2xl font-display font-semibold">{insumos.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {totalInsumosProducao} produção · {totalEmbalagens} embalagens
            </p>
          </div>
        </button>
        <button
          type="button"
          onClick={handleShowInsumosEmFalta}
          className={cn(
            "bg-card border border-border rounded-xl p-5 shadow-sm flex items-center gap-3 text-left transition-colors hover:border-warning/60 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            insumoStockFilter === 'atencao' && insumoTipoFilter === 'todos' && !insumoSearch.trim() && "border-warning/60 bg-warning/10"
          )}
          aria-label="Mostrar itens que precisam de atenção"
        >
          <div className="p-2 bg-warning/20 rounded-lg"><AlertTriangle className="text-warning w-5 h-5" /></div>
          <div><p className="text-sm text-muted-foreground">Em Falta</p><p className="text-2xl font-display font-semibold">{insumosEmFalta.length}</p></div>
        </button>
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Valor conhecido do estoque</p>
          <p className="text-2xl font-display font-semibold mt-1">{formatCurrencyBRL(valorConhecidoEstoque)}</p>
          {hasSaldoSemCusto && (
            <p className="mt-2 text-xs text-muted-foreground">
              Há saldo físico sem custo de compra informado.
            </p>
          )}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <div className="mb-4 space-y-4">
          <div>
            <h3 className="font-display font-semibold text-lg">Histórico de entradas</h3>
            <p className="text-sm text-muted-foreground">
              Lançamentos de compra ou ajuste inicial. O saldo consolidado fica em Estoque atual.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="purchase-tipo-filter" className="text-xs text-muted-foreground">Tipo</Label>
              <Select
                value={purchaseTipoFilter}
                onValueChange={(value) => {
                  setPurchaseTipoFilter(value as InsumoTipoFilter);
                  setPurchaseInsumoFilter('todos');
                }}
              >
                <SelectTrigger id="purchase-tipo-filter">
                  <SelectValue placeholder="Todos os tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os tipos</SelectItem>
                  {INSUMO_TIPOS_ESTOQUE.map((tipo) => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="purchase-insumo-filter" className="text-xs text-muted-foreground">Item</Label>
              <Select value={purchaseInsumoFilter} onValueChange={setPurchaseInsumoFilter}>
                <SelectTrigger id="purchase-insumo-filter">
                  <SelectValue placeholder="Todos os itens" />
                </SelectTrigger>
                <SelectContent side="bottom" align="start" avoidCollisions={false}>
                  <SelectItem value="todos">Todos os itens</SelectItem>
                  {purchaseFilterInsumos.map((insumo) => (
                    <SelectItem key={insumo.id} value={insumo.id}>{insumo.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="purchase-fornecedor-filter" className="text-xs text-muted-foreground">Fornecedor</Label>
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
            <div className="space-y-1.5">
              <Label htmlFor="purchase-origin-filter" className="text-xs text-muted-foreground">Origem</Label>
              <Select
                value={purchasePaymentOriginFilter}
                onValueChange={(value) => setPurchasePaymentOriginFilter(value as InsumoPaymentOriginFilter)}
              >
                <SelectTrigger id="purchase-origin-filter">
                  <SelectValue placeholder="Todas as origens" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as origens</SelectItem>
                  <SelectItem value="sem_valor">Sem valor</SelectItem>
                  <SelectItem value="fora_caixa">Fora do caixa</SelectItem>
                  <SelectItem value="caixa">Caixa da empresa</SelectItem>
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
            Carregando entradas...
          </div>
        ) : purchaseEntries.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground text-center">
            Nenhuma entrada encontrada para os filtros atuais.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {purchaseEntries.map((entry) => {
              const insumo = insumosPorId.get(entry.insumo_id);
              const fornecedor = entry.fornecedor_id ? fornecedoresPorId.get(entry.fornecedor_id) : null;
              const entryPackageReferenceLabel = entry.conteudo_por_embalagem
                ? formatInsumoPackageReference(entry.quantidade, entry.conteudo_por_embalagem, entry.unidade, {
                  includeAvailableQuantity: false,
                })
                : null;
              const dataCompraLabel = entry.data_compra
                ? formatLocalDate(entry.data_compra, 'dd/MM/yyyy')
                : 'Sem data de compra';

              return (
                <div key={entry.id} className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3 py-3">
                  <div>
                    <p className="font-medium text-foreground">{insumo?.nome || 'Item removido'}</p>
                    <p className="text-sm text-muted-foreground">
                      {getInsumoTipoEstoqueLabel(insumo?.tipo_estoque)} • {fornecedor?.nome || 'Sem fornecedor'} • {dataCompraLabel}
                    </p>
                  </div>
                  <div className="text-sm md:text-right">
                    <p className="font-medium text-foreground">
                      {formatInsumoQuantidade(entry.quantidade)} {entry.unidade}
                    </p>
                    {entryPackageReferenceLabel ? (
                      <p className="text-muted-foreground">{entryPackageReferenceLabel}</p>
                    ) : (
                      <p className="text-muted-foreground">Quantidade</p>
                    )}
                  </div>
                  <div className="text-sm md:text-right">
                    <p className="font-medium text-foreground">{formatCurrencyBRL(entry.valor_total)}</p>
                    <p className="text-muted-foreground">
                      {formatCurrencyBRLPrecise(entry.preco_unitario)} / {entry.unidade}
                    </p>
                    <p className="text-muted-foreground">
                      {getInsumoEntryPaymentOriginLabel(entry.origem_pagamento)}
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
          <h3 className="font-semibold text-lg text-foreground">Nenhum item</h3>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="font-display font-semibold text-lg">Estoque atual</h3>
              <p className="text-sm text-muted-foreground">
                {filteredInsumos.length} de {insumos.length} item{insumos.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-[1fr_180px] lg:max-w-5xl lg:grid-cols-[1fr_170px_190px_170px_auto]">
              <div className="relative">
                <Label htmlFor="insumos-search" className="sr-only">Buscar itens</Label>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <Input
                  id="insumos-search"
                  value={insumoSearch}
                  onChange={(event) => setInsumoSearch(event.target.value)}
                  placeholder="Buscar item..."
                  className="pl-10"
                />
              </div>
              <div>
                <Label htmlFor="insumos-stock-filter" className="sr-only">Filtrar itens por status</Label>
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
                <Label htmlFor="insumos-tipo-filter" className="sr-only">Filtrar itens por tipo</Label>
                <Select value={insumoTipoFilter} onValueChange={(value) => setInsumoTipoFilter(value as InsumoTipoFilter)}>
                  <SelectTrigger id="insumos-tipo-filter">
                    <SelectValue placeholder="Tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os tipos</SelectItem>
                    {INSUMO_TIPOS_ESTOQUE.map((tipo) => (
                      <SelectItem key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="insumos-sort" className="sr-only">Ordenar itens</Label>
                <Select value={insumoSort} onValueChange={(value) => setInsumoSort(value as InsumoSortOption)}>
                  <SelectTrigger id="insumos-sort">
                    <SelectValue placeholder="Ordenar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nome">Nome</SelectItem>
                    <SelectItem value="menor-saldo">Menor saldo</SelectItem>
                    <SelectItem value="maior-saldo">Maior saldo</SelectItem>
                    <SelectItem value="ultimo-custo">Custo conhecido</SelectItem>
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
            <span>Item</span>
            <span>Saldo</span>
            <span>Mínimo</span>
            <span>Custo conhecido</span>
            <span className="text-right">Ações</span>
          </div>
          {filteredInsumos.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              Nenhum item encontrado para os filtros atuais.
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
              const stockReference = stockReferenceByInsumoId.get(insumo.id);
              const currentStockPackageLabel = stockReference?.conteudo_por_embalagem
                ? formatInsumoCurrentStockPackageReference(
                  insumo.quantidade_atual,
                  stockReference.conteudo_por_embalagem,
                  insumo.unidade,
                )
                : null;
              const knownUnitCost = knownUnitCostByInsumoId.get(insumo.id) ?? 0;

              return (
                <div
                  key={insumo.id}
                  className="grid grid-cols-1 gap-3 px-4 py-4 lg:grid-cols-[1.5fr_0.8fr_0.8fr_1fr_auto] lg:items-center lg:gap-4 lg:px-5 lg:py-3"
                >
                  <div className="flex min-w-0 items-center justify-between gap-3 lg:block">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-foreground">{insumo.nome}</h3>
                      <p className="text-xs text-muted-foreground">
                        {getInsumoTipoEstoqueLabel(insumo.tipo_estoque)}
                      </p>
                      <p className="text-xs text-muted-foreground lg:hidden">
                        {formatCurrencyBRL(knownUnitCost)} / {insumo.unidade}
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
                      {currentStockPackageLabel && (
                        <p className="text-xs text-muted-foreground">{currentStockPackageLabel}</p>
                      )}
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
                      <p className="text-muted-foreground">{formatCurrencyBRL(knownUnitCost)} / {insumo.unidade}</p>
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
                        aria-label={`Editar cadastro do item ${insumo.nome}`}
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
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenExitDialog(insumo)}
                        className="shrink-0 gap-2"
                        disabled={insumo.quantidade_atual <= 0}
                      >
                        <ArrowDownCircle className="w-4 h-4" />
                        Saída
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
        .filter(b => b.ativo && b.categoria === 'brigadeiro')
        .map(b => getProdutoNomeComercial(b))
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
  const [tamanhoProdutoCadastroFilter, setTamanhoProdutoCadastroFilter] = useState<BrigadeiroTamanhoFilter>('todos');
  const [tamanhoProdutoVisualFilter, setTamanhoProdutoVisualFilter] = useState<BrigadeiroTamanhoFilter>('todos');
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
      .filter((brigadeiro) => matchesBrigadeiroTamanhoFilter(brigadeiro, tamanhoProdutoCadastroFilter))
      .sort(sortByProdutoNomeETamanho);
  }, [produtosBrigadeiro, produtos, tamanhoProdutoCadastroFilter]);

  const produtosOrdenados = useMemo(() => {
    return [...produtos].sort((a, b) => sortByProdutoNomeETamanho(
      getProdutoFinalCatalogo(a, brigadeirosPorId),
      getProdutoFinalCatalogo(b, brigadeirosPorId),
    ));
  }, [produtos, brigadeirosPorId]);

  const produtosFiltrados = useMemo(() => {
    return produtosOrdenados.filter((produto) => {
      const produtoCatalogo = getProdutoFinalCatalogo(produto, brigadeirosPorId);
      return tamanhoProdutoVisualFilter === 'todos'
        || matchesBrigadeiroTamanhoFilter(produtoCatalogo, tamanhoProdutoVisualFilter);
    });
  }, [brigadeirosPorId, produtosOrdenados, tamanhoProdutoVisualFilter]);

  const estoqueProdutosResumo = useMemo(() => summarizeEstoqueProdutosFinais(
    produtos.map((produto) => {
      const produtoCatalogo = getProdutoFinalCatalogo(produto, brigadeirosPorId);

        return {
          nome: produtoCatalogo.nome,
          categoria: produtoCatalogo.categoria,
          tamanho_g: produtoCatalogo.tamanho_g ?? null,
          quantidade_un: produto.quantidade_un,
        };
    }),
  ), [brigadeirosPorId, produtos]);

  if (loading) return <div className="py-8 text-center text-muted-foreground"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />Carregando...</div>;

  const handleRegister = async () => {
    if (!brigadeiroId) return;
    const brig = availableBrigadeiros.find(b => b.id === brigadeiroId) || produtosBrigadeiro.find(b => b.id === brigadeiroId);
    await addProduto(brigadeiroId, 0, brig?.nome || 'Produto Sem Nome');
    setBrigadeiroId('');
    setTamanhoProdutoCadastroFilter('todos');
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b border-border pb-4">
        <div>
           <h2 className="text-xl font-display font-semibold">Produtos Finais (Prontos)</h2>
           <p className="text-muted-foreground text-sm">Controle de itens prontos para entrega. No momento, o cadastro usa os brigadeiros como base.</p>
        </div>
        <Dialog open={isRegisterOpen} onOpenChange={(open) => {
          setIsRegisterOpen(open);
          if (!open) {
            setBrigadeiroId('');
            setTamanhoProdutoCadastroFilter('todos');
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
                    variant={tamanhoProdutoCadastroFilter === filter.value ? 'default' : 'ghost'}
                    className="flex-1 sm:flex-none px-4"
                    onClick={() => {
                      setTamanhoProdutoCadastroFilter(filter.value);
                      setBrigadeiroId('');
                    }}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
              <div className="space-y-2">
                <Label htmlFor="estoque-produto-base">Brigadeiro base</Label>
                <select id="estoque-produto-base" className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" value={brigadeiroId} onChange={e => setBrigadeiroId(e.target.value)}>
                   <option value="">Selecione um produto...</option>
                   {availableBrigadeiros.map((brigadeiro) => {
                     const tamanho = getProdutoTamanhoComercial(brigadeiro);
                     const nomeBase = getProdutoNomeComercial(brigadeiro);
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="bg-card border border-border p-4 rounded-xl shadow-sm">
          <p className="text-sm text-muted-foreground">Total geral</p>
          <p className="text-2xl font-display font-bold mt-1">{estoqueProdutosResumo.totalUnidades} un</p>
        </div>
        <div className="bg-card border border-border p-4 rounded-xl shadow-sm">
          <p className="text-sm text-muted-foreground">Brigadeiros 25g</p>
          <p className="text-2xl font-display font-bold mt-1">{estoqueProdutosResumo.total25g} un</p>
        </div>
        <div className="bg-card border border-border p-4 rounded-xl shadow-sm">
          <p className="text-sm text-muted-foreground">Brigadeiros 30g</p>
          <p className="text-2xl font-display font-bold mt-1">{estoqueProdutosResumo.total30g} un</p>
        </div>
      </div>

      <div className="flex w-full rounded-lg border border-border bg-muted/40 p-1 sm:w-fit">
        {BRIGADEIRO_TAMANHO_FILTERS.map((filter) => (
          <Button
            key={filter.value}
            type="button"
            size="sm"
            variant={tamanhoProdutoVisualFilter === filter.value ? 'default' : 'ghost'}
            className="flex-1 px-4 sm:flex-none"
            onClick={() => setTamanhoProdutoVisualFilter(filter.value)}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {produtosFiltrados.map(produto => {
          const produtoCatalogo = getProdutoFinalCatalogo(produto, brigadeirosPorId);
          const produtoBase = getProdutoNomeComercial(produtoCatalogo);
          const produtoTamanho = getProdutoTamanhoComercial(produtoCatalogo);

          return (
          <div key={produto.id} className="bg-card border border-border rounded-xl p-4 shadow-sm">
             <div className="flex items-start justify-between gap-3">
               <div className="min-w-0 space-y-2">
                 <div className="flex flex-wrap items-center gap-2">
                   {produtoTamanho && (
                     <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                       {produtoTamanho}
                     </span>
                   )}
                   <p className="text-sm font-medium text-muted-foreground">{produto.quantidade_un} un disponíveis</p>
                 </div>
                 <h3 className="font-display font-semibold text-lg leading-tight">{produtoBase}</h3>
               </div>
               <Button
                 variant="ghost"
                 size="icon"
                 className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                 onClick={() => setDeleteProdutoConfirm(produto)}
                 aria-label={`Inativar produto ${produto.brigadeiro?.nome || ''}`}
               >
                 <Trash2 className="w-4 h-4" />
               </Button>
             </div>
             <div className="grid grid-cols-2 gap-2 mt-4">
                <Button size="sm" variant="outline" className="text-success border-success/30 hover:bg-success/10 bg-success/5" onClick={() => { setActionProduto(produto); setActionType('add'); }}>
                   <ArrowUpCircle className="w-4 h-4 mr-2" /> Entrada
                </Button>
                <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10 bg-destructive/5" onClick={() => { setActionProduto(produto); setActionType('sub'); }}>
                   <ArrowDownCircle className="w-4 h-4 mr-2" /> Saída
                </Button>
             </div>
          </div>
          );
        })}
        {produtos.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground">Nenhum produto cadastrado no controle. Clique em Novo Produto para começar.</div>
        )}
        {produtos.length > 0 && produtosFiltrados.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground">Nenhum produto encontrado para o tamanho selecionado.</div>
        )}
      </div>

      {/* Action Dialog */}
      <Dialog open={!!actionProduto} onOpenChange={(open) => !open && setActionProduto(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{actionType === 'add' ? 'Registrar Entrada de Produto' : 'Registrar Saída de Produto'}</DialogTitle></DialogHeader>
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
            <AlertDialogTitle>Inativar produto final?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteProdutoConfirm?.brigadeiro?.nome || 'Este produto'} sairá do controle operacional de produtos finais, mas o histórico será preservado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Inativar
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
          <p className="text-muted-foreground mt-1">Controle integrado de insumos, embalagens, massas base e produtos finais</p>
        </div>
      </div>

      <Tabs defaultValue="insumos" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-2xl mb-8 border border-border shadow-sm p-1 rounded-lg">
          <TabsTrigger value="insumos" className="rounded-md">Insumos/Embalagens</TabsTrigger>
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
