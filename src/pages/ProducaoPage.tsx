import { useEffect, useState } from 'react';
import { Plus, Calendar, Loader2, Pencil, Trash2, AlertTriangle, Cookie } from 'lucide-react';
import { useProducao, ProducaoDiaria } from '@/hooks/useProducao';
import {
  PRODUCAO_STATUSES,
  calculateProductionLoss,
  type ProducaoStatus,
  getProducaoStatusLabel,
  getProducaoStatusBadgeClass,
  isProducaoConcluida,
} from '@/domain/producao';
import { supabase } from '@/integrations/supabase/client';
import { parseDecimalInput, parseIntegerInput } from '@/domain/numeros';
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
import { cn, formatLocalDate, parseLocalDate } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RecipeOption {
  id: string;
  recipeName: string;
  recipeType: string;
  versionNo: number;
  yieldQty: number;
  yieldUom: string;
}

interface RecipeIngredientPreview {
  recipeVersionId: string;
  stockItemId: string;
  nome: string;
  qtyPerBatch: number;
  uom: string;
}

type RecipeVersionOptionRow = {
  id: string;
  version_no: number;
  yield_qty: number | string;
  recipes?: { nome?: string; tipo?: string; yield_uom?: string } | null;
};

type RecipeComponentOptionRow = {
  recipe_version_id: string;
  stock_item_id: string;
  qty_per_batch: number | string;
  uom: string;
};

type StockItemNameRow = {
  id: string;
  nome: string;
};

export function ProducaoPage() {
  const {
    producao, loading, showDeleted, setShowDeleted,
    addProducao, updateProducaoStatus, updateProducao, cancelProducao,
  } = useProducao();
  const [recipeOptions, setRecipeOptions] = useState<RecipeOption[]>([]);
  const [recipeIngredients, setRecipeIngredients] = useState<Record<string, RecipeIngredientPreview[]>>({});
  const [loadingIntegrationOptions, setLoadingIntegrationOptions] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    data: format(new Date(), 'yyyy-MM-dd'),
    recipe_version_id: '',
    bateladas: '',
    integrar_estoque: false,
    observacoes: '',
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
  const [completeItem, setCompleteItem] = useState<ProducaoDiaria | null>(null);
  const [completeRendimentoReal, setCompleteRendimentoReal] = useState('');

  // Status labels/classes now come from domain helpers

  const today = format(new Date(), 'yyyy-MM-dd');
  const activeProducao = producao.filter(p => !p.deleted_at);
  const producoesPendentes = activeProducao.filter(p => !isProducaoConcluida(p.status)).length;
  const producoesParaHoje = activeProducao.filter(p => p.data === today && !isProducaoConcluida(p.status)).length;
  const producoesConcluidasHoje = activeProducao.filter(p => p.data === today && isProducaoConcluida(p.status)).length;
  const bateladasProducao = parseIntegerInput(formData.bateladas);
  const bateladasProducaoValida = Number.isInteger(bateladasProducao) && bateladasProducao > 0;
  const quantidadeEdicao = parseIntegerInput(editData.quantidade);
  const quantidadeEdicaoValida = Number.isInteger(quantidadeEdicao) && quantidadeEdicao > 0;
  const selectedRecipe = recipeOptions.find((recipe) => recipe.id === formData.recipe_version_id);
  const selectedIngredients = selectedRecipe ? recipeIngredients[selectedRecipe.id] || [] : [];
  const rendimentoPrevisto = selectedRecipe && bateladasProducaoValida
    ? selectedRecipe.yieldQty * bateladasProducao
    : 0;
  const rendimentoPrevistoUom = selectedRecipe?.yieldUom === 'lote'
    ? 'g'
    : selectedRecipe?.yieldUom || 'g';
  const consumoAutomaticoLabel = formData.integrar_estoque
    ? 'Os insumos serão consumidos ao concluir a produção.'
    : 'Planejamento sem consumo automático de insumos.';
  const rendimentoRealConclusao = parseDecimalInput(completeRendimentoReal);
  const rendimentoRealConclusaoValido = Number.isFinite(rendimentoRealConclusao) && rendimentoRealConclusao > 0;
  const perdaConclusao = completeItem ? calculateProductionLoss({
    rendimentoPrevisto: completeItem.rendimento_previsto,
    rendimentoReal: rendimentoRealConclusao,
  }) : null;

  useEffect(() => {
    let mounted = true;

    async function fetchIntegrationOptions() {
      setLoadingIntegrationOptions(true);

      try {
        const versionsResult = await supabase
          .from('recipe_versions')
          .select('id,version_no,yield_qty,recipes(nome,tipo,yield_uom)')
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        if (!mounted) return;

        const recipeList: RecipeOption[] = [];

        if (!versionsResult.error) {
          recipeList.push(...((versionsResult.data || []) as RecipeVersionOptionRow[]).map((item) => ({
            id: item.id,
            recipeName: item.recipes?.nome || 'Receita sem nome',
            recipeType: item.recipes?.tipo || 'receita',
            versionNo: item.version_no,
            yieldQty: Number(item.yield_qty || 0),
            yieldUom: item.recipes?.yield_uom || 'g',
          })));
          setRecipeOptions(recipeList);
        }

        const versionIds = recipeList.map((recipe) => recipe.id);
        if (versionIds.length === 0) {
          setRecipeIngredients({});
          return;
        }

        const componentsResult = await supabase
          .from('recipe_components')
          .select('recipe_version_id,stock_item_id,qty_per_batch,uom')
          .in('recipe_version_id', versionIds)
          .order('created_at', { ascending: true });

        if (componentsResult.error) return;

        const components = (componentsResult.data || []) as RecipeComponentOptionRow[];
        const stockItemIds = Array.from(new Set(components.map((component) => component.stock_item_id)));
        const stockItemsResult = stockItemIds.length > 0
          ? await supabase.from('stock_items').select('id,nome').in('id', stockItemIds)
          : { data: [], error: null };

        if (stockItemsResult.error) return;

        const stockNames = new Map(
          ((stockItemsResult.data || []) as StockItemNameRow[]).map((item) => [item.id, item.nome]),
        );
        const ingredientsByVersion = components.reduce<Record<string, RecipeIngredientPreview[]>>((acc, component) => {
          const item: RecipeIngredientPreview = {
            recipeVersionId: component.recipe_version_id,
            stockItemId: component.stock_item_id,
            nome: stockNames.get(component.stock_item_id) || 'Insumo sem nome',
            qtyPerBatch: Number(component.qty_per_batch || 0),
            uom: component.uom,
          };
          acc[component.recipe_version_id] = [...(acc[component.recipe_version_id] || []), item];
          return acc;
        }, {});

        setRecipeIngredients(ingredientsByVersion);
      } finally {
        if (mounted) setLoadingIntegrationOptions(false);
      }
    }

    fetchIntegrationOptions();

    return () => {
      mounted = false;
    };
  }, []);

  const handleAddProducao = async () => {
    const recipe = recipeOptions.find((item) => item.id === formData.recipe_version_id);
    if (!recipe) return;
    if (!bateladasProducaoValida) return;

    setSaving(true);
    try {
      const novaProducao = await addProducao({
        data: formData.data,
        brigadeiro_id: null,
        brigadeiro_nome: recipe.recipeName,
        quantidade: bateladasProducao,
        custo_total: 0,
        status: 'planejado',
      }, {
        enabled: false,
        recipeVersionId: recipe.id,
        consumeStockOnCompletion: formData.integrar_estoque,
        expectedYield: rendimentoPrevisto,
        notes: formData.observacoes || `Planejamento de massa - ${recipe.recipeName}`,
      });
      if (!novaProducao) return;

      setIsDialogOpen(false);
      setFormData({
        data: format(new Date(), 'yyyy-MM-dd'),
        recipe_version_id: '',
        bateladas: '',
        integrar_estoque: false,
        observacoes: '',
      });
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

  const openCompleteDialog = (item: ProducaoDiaria) => {
    setCompleteItem(item);
    setCompleteRendimentoReal(item.rendimento_real ? String(item.rendimento_real) : '');
  };

  const closeCompleteDialog = () => {
    setCompleteItem(null);
    setCompleteRendimentoReal('');
  };

  const handleStatusChange = (item: ProducaoDiaria, status: ProducaoDiaria['status']) => {
    if (status === 'concluido' && item.recipe_version_id && !isProducaoConcluida(item.status)) {
      openCompleteDialog(item);
      return;
    }

    updateProducaoStatus(item.id, status);
  };

  const handleComplete = async () => {
    if (!completeItem || !rendimentoRealConclusaoValido) return;

    setSaving(true);
    try {
      await updateProducaoStatus(completeItem.id, 'concluido', {
        rendimentoReal: rendimentoRealConclusao,
      });
      closeCompleteDialog();
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
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus size={18} />
              Planejar Produção
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">Nova Produção</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="producao-data">Data</Label>
                <Input id="producao-data" type="date" value={formData.data} onChange={(e) => setFormData({ ...formData, data: e.target.value })} />
              </div>
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
                    <SelectValue placeholder="Selecione a receita da massa" />
                  </SelectTrigger>
                  <SelectContent>
                    {recipeOptions.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        Nenhuma receita ativa cadastrada
                      </div>
                    ) : (
                      recipeOptions.map((recipe) => (
                        <SelectItem key={recipe.id} value={recipe.id}>
                          {recipe.recipeName}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {!loadingIntegrationOptions && recipeOptions.length === 0 && (
                  <p id="producao-receita-error" className="text-xs text-destructive">
                    Cadastre uma ficha de receita ativa antes de planejar produção.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="producao-bateladas">Quantidade de receitas</Label>
                <Input
                  id="producao-bateladas"
                  type="number"
                  min="1"
                  step="1"
                  value={formData.bateladas}
                  onChange={(e) => setFormData({ ...formData, bateladas: e.target.value })}
                  placeholder="Ex: 2"
                />
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
                      });
                    }}
                  />
                  <Label htmlFor="integrar-estoque" className="cursor-pointer">Consumir estoque automaticamente</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  O planejamento não movimenta estoque. {consumoAutomaticoLabel}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="producao-observacoes">Observações</Label>
                <Textarea
                  id="producao-observacoes"
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Ex: Produção para encomendas da semana"
                />
              </div>
              {selectedRecipe && bateladasProducaoValida && (
                <div className="p-3 bg-muted rounded-lg space-y-3">
                  <div>
                    <p className="text-sm font-medium">{selectedRecipe.recipeName}</p>
                    <p className="text-sm text-muted-foreground">
                      Rendimento previsto: {rendimentoPrevisto.toLocaleString('pt-BR')} {rendimentoPrevistoUom}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Ingredientes necessários</p>
                    {selectedIngredients.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhum insumo cadastrado na ficha da receita.</p>
                    ) : (
                      <ul className="space-y-1 text-xs text-muted-foreground">
                        {selectedIngredients.map((ingredient) => (
                          <li key={ingredient.stockItemId} className="flex justify-between gap-3">
                            <span>{ingredient.nome}</span>
                            <span className="font-medium text-foreground">
                              {(ingredient.qtyPerBatch * bateladasProducao).toLocaleString('pt-BR')} {ingredient.uom}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
              <Button
                onClick={handleAddProducao}
                className="w-full"
                disabled={
                  saving ||
                  !formData.recipe_version_id ||
                  !bateladasProducaoValida
                }
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Planejar Produção
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Pendentes</p>
          <p className="text-3xl font-display font-semibold mt-1">{producoesPendentes}</p>
          <p className="text-xs text-muted-foreground mt-1">Massas aguardando conclusão</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Para hoje</p>
          <p className="text-3xl font-display font-semibold mt-1">{producoesParaHoje}</p>
          <p className="text-xs text-muted-foreground mt-1">Massas planejadas para hoje</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Concluídas hoje</p>
          <p className="text-3xl font-display font-semibold mt-1">{producoesConcluidasHoje}</p>
          <p className="text-xs text-muted-foreground mt-1">Massas finalizadas hoje</p>
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
            A produção de <strong>{editConfirmItem?.brigadeiro_nome}</strong> já está concluída. Editar pode afetar o controle da massa. Deseja continuar?
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
              <Label htmlFor="producao-edit-quantidade">Receitas</Label>
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

      {/* Complete Dialog */}
      <Dialog open={!!completeItem} onOpenChange={(open) => { if (!open) closeCompleteDialog(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Concluir Produção</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="font-medium text-foreground">{completeItem?.brigadeiro_nome}</p>
              <p className="text-muted-foreground">
                Peso dos ingredientes: {Number(completeItem?.rendimento_previsto || 0).toLocaleString('pt-BR')} g
              </p>
              {completeItem?.consumir_estoque ? (
                <p className="text-xs text-muted-foreground mt-1">Os insumos serão consumidos ao concluir.</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="producao-rendimento-real">Peso real da massa pronta (g)</Label>
              <Input
                id="producao-rendimento-real"
                inputMode="decimal"
                value={completeRendimentoReal}
                onChange={(event) => setCompleteRendimentoReal(event.target.value)}
                placeholder="Ex: 1183"
              />
              <p className="text-xs text-muted-foreground">
                Informe o peso final depois do cozimento e da retirada da panela.
              </p>
            </div>
            {perdaConclusao && (
              <div className="rounded-lg border border-border p-3 text-sm">
                <p className="text-muted-foreground">
                  Quebra estimada:{' '}
                  <span className="font-medium text-foreground">
                    {perdaConclusao.perda.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} g
                  </span>
                  {' '}({perdaConclusao.percentual.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)
                </p>
              </div>
            )}
            <Button
              onClick={handleComplete}
              className="w-full"
              disabled={saving || !rendimentoRealConclusaoValido}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Concluir Produção
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
              Cancelar <strong>{cancelItem?.brigadeiro_nome}</strong> ({cancelItem?.quantidade} receita(s))?
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
                  const productionLoss = calculateProductionLoss({
                    rendimentoPrevisto: item.rendimento_previsto,
                    rendimentoReal: item.rendimento_real,
                  });

                  return (
                    <div key={item.id} className={cn("p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4", isDeleted && "opacity-50")}>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-medium">{item.brigadeiro_nome}</h4>
                          {isDeleted && <span className="text-xs text-destructive font-normal">(Cancelada)</span>}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {item.quantidade} receita(s)
                        </p>
                        {item.rendimento_previsto ? (
                          <p className="text-xs text-muted-foreground">
                            Peso dos ingredientes: {Number(item.rendimento_previsto).toLocaleString('pt-BR')} g
                          </p>
                        ) : null}
                        {item.rendimento_real ? (
                          <p className="text-xs text-muted-foreground">
                            Rendimento real: {Number(item.rendimento_real).toLocaleString('pt-BR')} g
                          </p>
                        ) : null}
                        {productionLoss ? (
                          <p className="text-xs text-muted-foreground">
                            Quebra: {productionLoss.perda.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} g ({productionLoss.percentual.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%)
                          </p>
                        ) : null}
                        {item.consumir_estoque && (
                          <p className="text-xs text-muted-foreground">
                            {item.insumos_consumidos_at ? 'Insumos consumidos' : 'Consumir insumos ao concluir'}
                          </p>
                        )}
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
                              onValueChange={(value: ProducaoDiaria['status']) => handleStatusChange(item, value)}
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
