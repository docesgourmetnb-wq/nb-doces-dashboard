import { useEffect, useMemo, useState } from 'react';
import { Plus, Calendar, Loader2, Pencil, Trash2, AlertTriangle, Cookie } from 'lucide-react';
import { useProducao, ProducaoDiaria } from '@/hooks/useProducao';
import {
  PRODUCAO_STATUSES,
  type ProducaoStatus,
  getProducaoStatusLabel,
  getProducaoStatusBadgeClass,
  isProducaoConcluida,
} from '@/domain/producao';
import { useBrigadeiros } from '@/hooks/useBrigadeiros';
import { supabase } from '@/integrations/supabase/client';
import { suggestProductionIntegration } from '@/domain/producaoIntegrada';
import { getProdutoNomeBase, getProdutoTamanho } from '@/domain/produtos';
import { parseIntegerInput } from '@/domain/numeros';
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
import { cn, formatCurrencyBRL, formatLocalDate, parseLocalDate } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RecipeOption {
  id: string;
  recipeName: string;
  recipeType: string;
  versionNo: number;
  yieldQty: number;
}

interface OutputItemOption {
  id: string;
  nome: string;
  tipo: string;
  unidadeBase: string;
}

const typeLabel: Record<string, string> = {
  consumo: 'Consumo',
  massa_base: 'Massa base',
  produto_final: 'Produto final',
};

type TamanhoProdutoFilter = 'todos' | '25g' | '30g';

const tamanhoProdutoFilters: Array<{ value: TamanhoProdutoFilter; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: '25g', label: '25g' },
  { value: '30g', label: '30g' },
];

function getTamanhoSortValue(tamanho: string | null) {
  return Number(tamanho?.replace(',', '.').replace(/g$/i, '') ?? Number.POSITIVE_INFINITY);
}

function sortByProdutoNomeETamanho<T extends { nome?: string | null | undefined }>(a: T, b: T) {
  const nomeA = a.nome || '';
  const nomeB = b.nome || '';
  const nomeBaseCompare = getProdutoNomeBase(nomeA).localeCompare(getProdutoNomeBase(nomeB), 'pt-BR');
  if (nomeBaseCompare !== 0) return nomeBaseCompare;
  return getTamanhoSortValue(getProdutoTamanho(nomeA)) - getTamanhoSortValue(getProdutoTamanho(nomeB));
}

export function ProducaoPage() {
  const {
    producao, loading, showDeleted, setShowDeleted,
    addProducao, updateProducaoStatus, updateProducao, cancelProducao,
  } = useProducao();
  const { brigadeiros } = useBrigadeiros();
  const [recipeOptions, setRecipeOptions] = useState<RecipeOption[]>([]);
  const [outputItemOptions, setOutputItemOptions] = useState<OutputItemOption[]>([]);
  const [loadingIntegrationOptions, setLoadingIntegrationOptions] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tamanhoProdutoFilter, setTamanhoProdutoFilter] = useState<TamanhoProdutoFilter>('todos');
  const [formData, setFormData] = useState({
    data: format(new Date(), 'yyyy-MM-dd'),
    brigadeiro_id: '',
    quantidade: '',
    integrar_estoque: false,
    recipe_version_id: '',
    output_item_id: '',
  });

  // Edit state
  const [editItem, setEditItem] = useState<ProducaoDiaria | null>(null);
  const [editData, setEditData] = useState<{ data: string; quantidade: string; status: ProducaoStatus | '' }>({
    data: '',
    quantidade: '',
    status: '',
  });

  // Confirmation for editing concluido
  const [editConfirmItem, setEditConfirmItem] = useState<ProducaoDiaria | null>(null);

  // Cancel state
  const [cancelItem, setCancelItem] = useState<ProducaoDiaria | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Status labels/classes now come from domain helpers

  const today = format(new Date(), 'yyyy-MM-dd');
  const activeProducao = producao.filter(p => !p.deleted_at);
  const totalUnidadesHoje = activeProducao.filter(p => p.data === today).reduce((acc, p) => acc + p.quantidade, 0);
  const totalCustoHoje = activeProducao.filter(p => p.data === today).reduce((acc, p) => acc + p.custo_total, 0);
  const quantidadeProducao = parseIntegerInput(formData.quantidade);
  const quantidadeProducaoValida = Number.isInteger(quantidadeProducao) && quantidadeProducao > 0;
  const quantidadeEdicao = parseIntegerInput(editData.quantidade);
  const quantidadeEdicaoValida = Number.isInteger(quantidadeEdicao) && quantidadeEdicao > 0;
  const brigadeirosDisponiveis = useMemo(() => {
    return brigadeiros
      .filter((brigadeiro) => {
        const tamanho = getProdutoTamanho(brigadeiro.nome);
        return tamanhoProdutoFilter === 'todos' || tamanho === tamanhoProdutoFilter;
      })
      .sort(sortByProdutoNomeETamanho);
  }, [brigadeiros, tamanhoProdutoFilter]);

  useEffect(() => {
    let mounted = true;

    async function fetchIntegrationOptions() {
      setLoadingIntegrationOptions(true);

      const [versionsResult, stockItemsResult] = await Promise.all([
        supabase
          .from('recipe_versions')
          .select('id,version_no,yield_qty,recipes(nome,tipo)')
          .eq('status', 'active')
          .order('created_at', { ascending: false }),
        supabase
          .from('stock_items')
          .select('id,nome,tipo,unidade_base')
          .in('tipo', ['massa_base', 'produto_final'])
          .eq('ativo', true)
          .order('nome', { ascending: true }),
      ]);

      if (!mounted) return;

      if (!versionsResult.error) {
        setRecipeOptions(((versionsResult.data || []) as unknown[]).map((row) => {
          const item = row as {
            id: string;
            version_no: number;
            yield_qty: number | string;
            recipes?: { nome?: string; tipo?: string } | null;
          };

          return {
            id: item.id,
            recipeName: item.recipes?.nome || 'Receita sem nome',
            recipeType: item.recipes?.tipo || 'receita',
            versionNo: item.version_no,
            yieldQty: Number(item.yield_qty || 0),
          };
        }));
      }

      if (!stockItemsResult.error) {
        setOutputItemOptions(((stockItemsResult.data || []) as unknown[]).map((row) => {
          const item = row as {
            id: string;
            nome: string;
            tipo: string;
            unidade_base: string;
          };

          return {
            id: item.id,
            nome: item.nome,
            tipo: item.tipo,
            unidadeBase: item.unidade_base,
          };
        }));
      }

      setLoadingIntegrationOptions(false);
    }

    fetchIntegrationOptions();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!formData.integrar_estoque || !formData.brigadeiro_id || loadingIntegrationOptions) return;

    const brigadeiro = brigadeiros.find((item) => item.id === formData.brigadeiro_id);
    if (!brigadeiro) return;

    const suggestion = suggestProductionIntegration(brigadeiro.nome, recipeOptions, outputItemOptions);
    if (!suggestion) return;

    setFormData((current) => {
      if (!current.integrar_estoque || current.brigadeiro_id !== brigadeiro.id) return current;

      const nextRecipeVersionId = current.recipe_version_id || suggestion.recipeVersionId;
      const nextOutputItemId = current.output_item_id || suggestion.outputItemId;
      if (current.recipe_version_id === nextRecipeVersionId && current.output_item_id === nextOutputItemId) {
        return current;
      }

      return {
        ...current,
        recipe_version_id: nextRecipeVersionId,
        output_item_id: nextOutputItemId,
      };
    });
  }, [
    formData.integrar_estoque,
    formData.brigadeiro_id,
    brigadeiros,
    loadingIntegrationOptions,
    outputItemOptions,
    recipeOptions,
  ]);

  const handleAddProducao = async () => {
    const brigadeiro = brigadeiros.find(b => b.id === formData.brigadeiro_id);
    if (!brigadeiro) return;
    if (!quantidadeProducaoValida) return;
    const integrationOptions = {
      enabled: formData.integrar_estoque,
      notes: `Integração automática - ${brigadeiro.nome}`,
      ...(formData.recipe_version_id ? { recipeVersionId: formData.recipe_version_id } : {}),
      ...(formData.output_item_id ? { outputItemId: formData.output_item_id } : {}),
    };

    setSaving(true);
    try {
      const novaProducao = await addProducao({
        data: formData.data,
        brigadeiro_id: brigadeiro.id,
        brigadeiro_nome: brigadeiro.nome,
        quantidade: quantidadeProducao,
        custo_total: 0,
        status: formData.integrar_estoque ? 'concluido' : 'planejado',
      }, integrationOptions);
      if (!novaProducao) return;

      setIsDialogOpen(false);
      setFormData({
        data: format(new Date(), 'yyyy-MM-dd'),
        brigadeiro_id: '',
        quantidade: '',
        integrar_estoque: false,
        recipe_version_id: '',
        output_item_id: '',
      });
      setTamanhoProdutoFilter('todos');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (item: ProducaoDiaria) => {
    // Guardrail: if concluido, show confirmation first
    if (isProducaoConcluida(item.status)) {
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
    const updates: Partial<Pick<ProducaoDiaria, 'data' | 'quantidade' | 'status'>> = {};
    if (editData.data) updates.data = editData.data;
    if (editData.quantidade) {
      if (!quantidadeEdicaoValida) {
        return;
      }
      updates.quantidade = quantidadeEdicao;
    }
    if (editData.status) updates.status = editData.status;

    setSaving(true);
    try {
      await updateProducao(editItem.id, updates);
      setEditItem(null);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelItem) return;
    setSaving(true);
    try {
      await cancelProducao(cancelItem.id, cancelReason);
      setCancelItem(null);
      setCancelReason('');
    } finally {
      setSaving(false);
    }
  };

  // Group by date
  const producaoByDate = producao.reduce((acc, item) => {
    const dateKey = item.data;
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(item);
    return acc;
  }, {} as Record<string, ProducaoDiaria[]>);

  const sortedDates = Object.keys(producaoByDate).sort((a, b) => parseLocalDate(b).getTime() - parseLocalDate(a).getTime());

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
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setTamanhoProdutoFilter('todos');
        }}>
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
                <Label htmlFor="producao-data">Data</Label>
                <Input id="producao-data" type="date" value={formData.data} onChange={(e) => setFormData({ ...formData, data: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="producao-sabor">Produto</Label>
                <div className="flex w-full sm:w-fit rounded-lg border border-border bg-muted/40 p-1">
                  {tamanhoProdutoFilters.map((filter) => (
                    <Button
                      key={filter.value}
                      type="button"
                      size="sm"
                      variant={tamanhoProdutoFilter === filter.value ? 'default' : 'ghost'}
                      className="flex-1 sm:flex-none px-4"
                      onClick={() => {
                        setTamanhoProdutoFilter(filter.value);
                        setFormData({ ...formData, brigadeiro_id: '' });
                      }}
                    >
                      {filter.label}
                    </Button>
                  ))}
                </div>
                <Select value={formData.brigadeiro_id} onValueChange={(v) => setFormData({ ...formData, brigadeiro_id: v })}>
                  <SelectTrigger id="producao-sabor"><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                  <SelectContent>
                    {brigadeirosDisponiveis.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        Nenhum produto nesse tamanho
                      </div>
                    ) : (
                      brigadeirosDisponiveis.map((brigadeiro) => {
                        const tamanho = getProdutoTamanho(brigadeiro.nome);
                        const nomeBase = getProdutoNomeBase(brigadeiro.nome);
                        const label = tamanho ? `${nomeBase} • ${tamanho}` : brigadeiro.nome;

                        return (
                          <SelectItem key={brigadeiro.id} value={brigadeiro.id}>
                            {label}
                          </SelectItem>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="producao-quantidade">Quantidade</Label>
                <Input id="producao-quantidade" type="number" min="1" step="1" value={formData.quantidade} onChange={(e) => setFormData({ ...formData, quantidade: e.target.value })} placeholder="Ex: 50" />
              </div>
              <div className="rounded-lg border border-border p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="integrar-estoque"
                    checked={formData.integrar_estoque}
                    onCheckedChange={(v) => {
                      const checked = v === true;
                      setFormData({
                        ...formData,
                        integrar_estoque: checked,
                        recipe_version_id: checked ? formData.recipe_version_id : '',
                        output_item_id: checked ? formData.output_item_id : '',
                      });
                    }}
                  />
                  <Label htmlFor="integrar-estoque" className="cursor-pointer">Consumir estoque automaticamente</Label>
                </div>
                {formData.integrar_estoque && (
                  <div className="space-y-2">
                    {loadingIntegrationOptions ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Carregando receitas e itens de estoque...
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Selecione a receita ativa e o item que receberá a saída da produção.
                      </p>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="producao-receita">Receita ativa</Label>
                      <Select
                        value={formData.recipe_version_id}
                        onValueChange={(value) => setFormData({ ...formData, recipe_version_id: value })}
                        disabled={loadingIntegrationOptions || recipeOptions.length === 0}
                      >
                        <SelectTrigger
                          id="producao-receita"
                          aria-describedby={!loadingIntegrationOptions && recipeOptions.length === 0 ? 'producao-receita-error' : undefined}
                        >
                          <SelectValue placeholder="Selecione a receita" />
                        </SelectTrigger>
                        <SelectContent>
                          {recipeOptions.map((recipe) => (
                            <SelectItem key={recipe.id} value={recipe.id}>
                              {recipe.recipeName} v{recipe.versionNo} - {typeLabel[recipe.recipeType] || recipe.recipeType} ({recipe.yieldQty}g)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!loadingIntegrationOptions && recipeOptions.length === 0 && (
                        <p id="producao-receita-error" className="text-xs text-destructive">Nenhuma receita ativa cadastrada.</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="producao-item-saida">Item de saída</Label>
                      <Select
                        value={formData.output_item_id}
                        onValueChange={(value) => setFormData({ ...formData, output_item_id: value })}
                        disabled={loadingIntegrationOptions || outputItemOptions.length === 0}
                      >
                        <SelectTrigger
                          id="producao-item-saida"
                          aria-describedby={!loadingIntegrationOptions && outputItemOptions.length === 0 ? 'producao-item-saida-error' : undefined}
                        >
                          <SelectValue placeholder="Selecione o item produzido" />
                        </SelectTrigger>
                        <SelectContent>
                          {outputItemOptions.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.nome} ({typeLabel[item.tipo] || item.tipo}, {item.unidadeBase})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!loadingIntegrationOptions && outputItemOptions.length === 0 && (
                        <p id="producao-item-saida-error" className="text-xs text-destructive">Nenhum item de saída cadastrado no estoque integrado.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {formData.brigadeiro_id && quantidadeProducaoValida && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium">
                    Custo estimado: {formatCurrencyBRL(quantidadeProducao * (brigadeiros.find(b => b.id === formData.brigadeiro_id)?.custo_unitario || 0))}
                  </p>
                </div>
              )}
              <Button
                onClick={handleAddProducao}
                className="w-full"
                disabled={
                  saving ||
                  !formData.brigadeiro_id ||
                  !quantidadeProducaoValida ||
                  (formData.integrar_estoque && (!formData.recipe_version_id || !formData.output_item_id))
                }
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {formData.integrar_estoque ? 'Executar Produção Integrada' : 'Adicionar à Produção'}
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
          <p className="text-3xl font-display font-semibold mt-1">{formatCurrencyBRL(totalCustoHoje)}</p>
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
              <Label htmlFor="producao-edit-data">Data</Label>
              <Input id="producao-edit-data" type="date" value={editData.data} onChange={(e) => setEditData({ ...editData, data: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="producao-edit-quantidade">Quantidade</Label>
              <Input id="producao-edit-quantidade" type="number" min="1" step="1" value={editData.quantidade} onChange={(e) => setEditData({ ...editData, quantidade: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="producao-edit-status">Status</Label>
              <Select value={editData.status} onValueChange={(v: ProducaoStatus) => setEditData({ ...editData, status: v })}>
                <SelectTrigger id="producao-edit-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                {PRODUCAO_STATUSES.map(s => (
                    <SelectItem key={s} value={s}>{getProducaoStatusLabel(s)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleEdit} className="w-full" disabled={saving || !quantidadeEdicaoValida}>
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
              <Label htmlFor="producao-cancel-reason">Motivo (opcional)</Label>
              <Textarea id="producao-cancel-reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Ex: Ingredientes insuficientes" />
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
                  {formatLocalDate(dateKey, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </h3>
              </div>
              <div className="divide-y divide-border">
                {(producaoByDate[dateKey] || []).map((item) => {
                  const isDeleted = !!item.deleted_at;
                  const produtoBase = getProdutoNomeBase(item.brigadeiro_nome);
                  const produtoTamanho = getProdutoTamanho(item.brigadeiro_nome);

                  return (
                    <div key={item.id} className={cn("p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4", isDeleted && "opacity-50")}>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {produtoTamanho && (
                            <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary">
                              {produtoTamanho}
                            </span>
                          )}
                          <h4 className="font-medium">{produtoBase}</h4>
                          {isDeleted && <span className="text-xs text-destructive font-normal">(Cancelada)</span>}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {item.quantidade} unidades • Custo: {formatCurrencyBRL(item.custo_total)}
                        </p>
                        {isDeleted && item.deleted_reason && (
                          <p className="text-xs text-muted-foreground mt-1">Motivo: {item.deleted_reason}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {!isDeleted && (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => openEdit(item)} className="h-8 w-8" aria-label={`Editar produção de ${item.brigadeiro_nome}`}>
                              <Pencil size={14} />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setCancelItem(item)} className="h-8 w-8 text-destructive hover:text-destructive" aria-label={`Cancelar produção de ${item.brigadeiro_nome}`}>
                              <Trash2 size={14} />
                            </Button>
                            <Select
                              value={item.status}
                              onValueChange={(value: ProducaoDiaria['status']) => updateProducaoStatus(item.id, value)}
                            >
                              <SelectTrigger aria-label={`Status da produção de ${item.brigadeiro_nome}`} className={cn("w-full sm:w-[160px] text-xs font-medium rounded-full px-3", getProducaoStatusBadgeClass(item.status))}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {PRODUCAO_STATUSES.map(s => (
                                  <SelectItem key={s} value={s}>{getProducaoStatusLabel(s)}</SelectItem>
                                ))}
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
