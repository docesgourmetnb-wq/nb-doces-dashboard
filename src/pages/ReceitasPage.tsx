import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { parseDecimalInput } from '@/domain/numeros';
import { calculateCommercialRecipeYields, summarizeRecipeMass } from '@/domain/receitas';

const UOM_OPTIONS = ['g', 'kg', 'ml', 'l', 'un'] as const;
type Uom = (typeof UOM_OPTIONS)[number];

type RecipeRow = {
  id: string;
  nome: string;
  tipo: string;
  ativo: boolean;
};

type RecipeVersionRow = {
  id: string;
  recipe_id: string;
  version_no: number;
  status: 'draft' | 'active' | 'archived';
  yield_qty: number;
  peso_total_massa_g: number | null;
  peso_unitario_base_g: number | null;
};

type StockItemRow = {
  id: string;
  nome: string;
  unidade_base: string;
  tipo: 'insumo' | 'massa_base' | 'produto_final';
};

type InsumoRow = {
  id: string;
  nome: string;
  unidade: string;
};

type RecipeComponentRow = {
  id: string;
  stock_item_id: string;
  qty_per_batch: number;
  uom: string;
  component_type: 'base' | 'adicional' | 'embalagem' | 'perda_planejada';
  waste_factor: number;
};

type RecipeTableRow = Tables<'recipes'>;
type RecipeInsert = TablesInsert<'recipes'>;
type RecipeUpdate = TablesUpdate<'recipes'>;
type RecipeVersionTableRow = Tables<'recipe_versions'>;
type RecipeVersionInsert = TablesInsert<'recipe_versions'>;
type RecipeVersionUpdate = TablesUpdate<'recipe_versions'>;
type StockItemTableRow = Pick<Tables<'stock_items'>, 'id' | 'nome' | 'unidade_base' | 'tipo'>;
type StockItemInsert = TablesInsert<'stock_items'>;
type InsumoTableRow = Pick<Tables<'insumos'>, 'id' | 'nome' | 'unidade'>;
type RecipeComponentTableRow = Tables<'recipe_components'>;
type RecipeComponentInsert = TablesInsert<'recipe_components'>;

type RecipeListTableRow = Pick<RecipeTableRow, 'id' | 'nome' | 'tipo' | 'ativo'>;
type RecipeVersionListTableRow = Pick<
  RecipeVersionTableRow,
  'id' | 'recipe_id' | 'version_no' | 'status' | 'yield_qty' | 'peso_total_massa_g' | 'peso_unitario_base_g'
>;
type RecipeComponentListTableRow = Pick<
  RecipeComponentTableRow,
  'id' | 'stock_item_id' | 'qty_per_batch' | 'uom' | 'component_type' | 'waste_factor'
>;

function toRecipeRow(row: RecipeListTableRow): RecipeRow {
  return {
    id: row.id,
    nome: row.nome,
    tipo: row.tipo,
    ativo: row.ativo,
  };
}

function toRecipeVersionRow(row: RecipeVersionListTableRow): RecipeVersionRow {
  return {
    id: row.id,
    recipe_id: row.recipe_id,
    version_no: row.version_no,
    status: row.status as RecipeVersionRow['status'],
    yield_qty: row.yield_qty,
    peso_total_massa_g: row.peso_total_massa_g,
    peso_unitario_base_g: row.peso_unitario_base_g,
  };
}

function toStockItemRow(row: StockItemTableRow): StockItemRow {
  return {
    id: row.id,
    nome: row.nome,
    unidade_base: row.unidade_base,
    tipo: row.tipo as StockItemRow['tipo'],
  };
}

function toInsumoRow(row: InsumoTableRow): InsumoRow {
  return {
    id: row.id,
    nome: row.nome,
    unidade: row.unidade,
  };
}

function toRecipeComponentRow(row: RecipeComponentListTableRow): RecipeComponentRow {
  return {
    id: row.id,
    stock_item_id: row.stock_item_id,
    qty_per_batch: row.qty_per_batch,
    uom: row.uom,
    component_type: row.component_type as RecipeComponentRow['component_type'],
    waste_factor: row.waste_factor,
  };
}

type ConfirmState =
  | { kind: 'recipe'; id: string; nome: string }
  | { kind: 'version'; id: string; label: string }
  | { kind: 'component'; id: string; label: string }
  | null;

export function ReceitasPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [versions, setVersions] = useState<RecipeVersionRow[]>([]);
  const [components, setComponents] = useState<RecipeComponentRow[]>([]);
  const [stockItems, setStockItems] = useState<StockItemRow[]>([]);
  const [insumosEstoque, setInsumosEstoque] = useState<InsumoRow[]>([]);
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  const [newRecipe, setNewRecipe] = useState({ nome: '' });
  const [savingRecipe, setSavingRecipe] = useState(false);
  const [savingFormula, setSavingFormula] = useState(false);
  const [newComponent, setNewComponent] = useState({
    stock_item_id: '',
    qty_per_batch: '',
    uom: 'g' as Uom,
  });

  const loadBase = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [recipesRes, stockRes, insumosRes] = await Promise.all([
        supabase
          .from('recipes')
          .select('id,nome,tipo,ativo,deleted_at')
          .is('deleted_at', null)
          .order('nome'),
        supabase.from('stock_items').select('id,nome,unidade_base,tipo').order('nome'),
        supabase
          .from('insumos')
          .select('id,nome,unidade')
          .not('unidade', 'in', '("SYS_MASSA","SYS_PROD")')
          .order('nome'),
      ]);

      if (recipesRes.error || stockRes.error || insumosRes.error) {
        toast({
          title: 'Erro ao carregar receitas',
          description:
            recipesRes.error?.message ||
            stockRes.error?.message ||
            insumosRes.error?.message ||
            'Falha desconhecida.',
          variant: 'destructive',
        });
      } else {
        setRecipes((recipesRes.data || []).map(toRecipeRow));
        setStockItems((stockRes.data || []).map(toStockItemRow));
        setInsumosEstoque((insumosRes.data || []).map(toInsumoRow));
      }
    } finally {
      setLoading(false);
    }
  }, [toast, user]);

  const loadVersions = useCallback(async () => {
    if (!selectedRecipeId) {
      setVersions([]);
      setSelectedVersionId('');
      return;
    }
    const { data, error } = await supabase
      .from('recipe_versions')
      .select('id,recipe_id,version_no,status,yield_qty,peso_total_massa_g,peso_unitario_base_g')
      .eq('recipe_id', selectedRecipeId)
      .order('version_no', { ascending: false });
    if (error) {
      toast({ title: 'Erro ao carregar versões', description: error.message, variant: 'destructive' });
      return;
    }
    const list = (data || [])
      .map(toRecipeVersionRow)
      .sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (a.status !== 'active' && b.status === 'active') return 1;
        return b.version_no - a.version_no;
      });
    setVersions(list);
    if (!list.find((v) => v.id === selectedVersionId)) {
      setSelectedVersionId(list[0]?.id || '');
    }
  }, [selectedRecipeId, selectedVersionId, toast]);

  const loadComponents = useCallback(async () => {
    if (!selectedVersionId) {
      setComponents([]);
      return [];
    }
    const { data, error } = await supabase
      .from('recipe_components')
      .select('id,stock_item_id,qty_per_batch,uom,component_type,waste_factor')
      .eq('recipe_version_id', selectedVersionId)
      .order('sort_order');
    if (error) {
      toast({ title: 'Erro ao carregar componentes', description: error.message, variant: 'destructive' });
      return [];
    }
    const list = (data || []).map(toRecipeComponentRow);
    setComponents(list);
    return list;
  }, [selectedVersionId, toast]);

  useEffect(() => { loadBase(); }, [loadBase]);
  useEffect(() => { loadVersions(); }, [loadVersions]);
  useEffect(() => { loadComponents(); }, [loadComponents]);

  const selectedRecipe = useMemo(() => recipes.find((r) => r.id === selectedRecipeId), [recipes, selectedRecipeId]);
  const selectedVersion = useMemo(() => versions.find((v) => v.id === selectedVersionId), [versions, selectedVersionId]);
  const selectedVersionMass = useMemo(() => summarizeRecipeMass(components), [components]);
  const selectedVersionYields = useMemo(
    () => calculateCommercialRecipeYields(selectedVersionMass.totalGrams),
    [selectedVersionMass.totalGrams],
  );

  /** Insumos disponíveis vêm direto do Estoque (tabela `insumos`). */
  const insumosStock = useMemo(
    () =>
      insumosEstoque.map((i) => ({
        id: i.id,
        nome: i.nome,
        unidade_base: i.unidade,
      })),
    [insumosEstoque]
  );

  const addRecipe = async () => {
    const nome = newRecipe.nome.trim();
    if (!user || !nome) return;
    setSavingRecipe(true);
    try {
      const recipe: RecipeInsert = {
        user_id: user.id,
        nome,
        tipo: 'consumo',
        yield_uom: 'lote',
      };

      const { error } = await supabase.from('recipes').insert(recipe);
      if (error) {
        toast({ title: 'Erro ao criar receita', description: error.message, variant: 'destructive' });
        return;
      }
      setNewRecipe({ nome: '' });
      await loadBase();
      toast({ title: 'Receita criada' });
    } finally {
      setSavingRecipe(false);
    }
  };

  const addFormula = async () => {
    if (!user || !selectedRecipeId) return;
    setSavingFormula(true);

    try {
      const version: RecipeVersionInsert = {
        user_id: user.id,
        recipe_id: selectedRecipeId,
        version_no: 1,
        status: 'active',
        yield_qty: 1, // atualizado automaticamente após inserir os insumos
        peso_total_massa_g: null,
        peso_unitario_base_g: 25,
      };

      const { error } = await supabase.from('recipe_versions').insert(version);
      if (error) {
        toast({ title: 'Erro ao criar ficha da massa', description: error.message, variant: 'destructive' });
        return;
      }
      await loadVersions();
      toast({ title: 'Ficha da massa criada' });
    } finally {
      setSavingFormula(false);
    }
  };

  const syncVersionMass = useCallback(
    async (versionId: string, nextComponents: RecipeComponentRow[]) => {
      const mass = summarizeRecipeMass(nextComponents);
      const pesoTotal = mass.totalGrams > 0 ? mass.totalGrams : null;
      const updates: RecipeVersionUpdate = {
        peso_total_massa_g: pesoTotal,
        yield_qty: pesoTotal ?? 1,
      };

      const { error } = await supabase.from('recipe_versions').update(updates).eq('id', versionId);
      if (error) {
        toast({ title: 'Erro ao recalcular peso da receita', description: error.message, variant: 'destructive' });
        return;
      }

      setVersions((current) =>
        current.map((version) =>
          version.id === versionId
            ? {
                ...version,
                peso_total_massa_g: pesoTotal,
                yield_qty: pesoTotal ?? 1,
              }
            : version,
        ),
      );
    },
    [toast],
  );

  const addComponent = async () => {
    if (!user || !selectedVersionId || !newComponent.stock_item_id) return;
    const qty = parseDecimalInput(newComponent.qty_per_batch);
    if (!qty || qty <= 0) return;

    const insumo = insumosEstoque.find((i) => i.id === newComponent.stock_item_id);
    if (!insumo) return;

    let stockId = stockItems.find(
      (s) => s.tipo === 'insumo' && s.nome.toLowerCase() === insumo.nome.toLowerCase()
    )?.id;

    if (!stockId) {
      const stockItem: StockItemInsert = {
        user_id: user.id,
        nome: insumo.nome,
        unidade_base: insumo.unidade,
        tipo: 'insumo',
      };

      const { data: created, error: createErr } = await supabase
        .from('stock_items')
        .insert(stockItem)
        .select('id,nome,unidade_base,tipo')
        .single();
      if (createErr || !created) {
        toast({ title: 'Erro ao vincular insumo', description: createErr?.message, variant: 'destructive' });
        return;
      }
      const createdStockItem = toStockItemRow(created);
      stockId = createdStockItem.id;
      setStockItems((prev) => [...prev, createdStockItem]);
    }

    const component: RecipeComponentInsert = {
      user_id: user.id,
      recipe_version_id: selectedVersionId,
      stock_item_id: stockId,
      qty_per_batch: qty,
      uom: newComponent.uom,
      component_type: 'base',
      waste_factor: 0,
    };

    const { error } = await supabase.from('recipe_components').insert(component);
    if (error) {
      toast({ title: 'Erro ao adicionar insumo', description: error.message, variant: 'destructive' });
      return;
    }
    setNewComponent({ stock_item_id: '', qty_per_batch: '', uom: 'g' });
    const nextComponents = await loadComponents();
    await syncVersionMass(selectedVersionId, nextComponents);
    toast({ title: 'Insumo adicionado' });
  };

  // ===== Exclusões =====
  const doDeleteRecipe = async (id: string) => {
    const updates: RecipeUpdate = {
      deleted_at: new Date().toISOString(),
      ativo: false,
    };

    const { error } = await supabase
      .from('recipes')
      .update(updates)
      .eq('id', id);
    if (error) {
      toast({ title: 'Erro ao excluir receita', description: error.message, variant: 'destructive' });
      return;
    }
    if (selectedRecipeId === id) {
      setSelectedRecipeId('');
      setSelectedVersionId('');
    }
    await loadBase();
    toast({ title: 'Receita excluída' });
  };

  const doDeleteVersion = async (id: string) => {
    // Bloqueia se houver produção vinculada
    const { count, error: prodErr } = await supabase
      .from('producao_diaria')
      .select('id', { count: 'exact', head: true })
      .eq('brigadeiro_id', id); // fallback: nem sempre vinculado por recipe_version_id
    // Não há FK direta no schema atual; mantemos checagem permissiva. Se erro, prosseguir.
    if (!prodErr && count && count > 0) {
      toast({
        title: 'Não é possível excluir',
        description: 'Existe produção vinculada a esta ficha da massa.',
        variant: 'destructive',
      });
      return;
    }

    // Apaga componentes primeiro
    await supabase.from('recipe_components').delete().eq('recipe_version_id', id);
    const { error } = await supabase.from('recipe_versions').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao excluir ficha da massa', description: error.message, variant: 'destructive' });
      return;
    }
    if (selectedVersionId === id) setSelectedVersionId('');
    await loadVersions();
    toast({ title: 'Ficha da massa excluída' });
  };

  const doDeleteComponent = async (id: string) => {
    if (!selectedVersionId) return;
    const { error } = await supabase.from('recipe_components').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao remover insumo', description: error.message, variant: 'destructive' });
      return;
    }
    const nextComponents = await loadComponents();
    await syncVersionMass(selectedVersionId, nextComponents);
    toast({ title: 'Insumo removido' });
  };

  const handleConfirm = async () => {
    if (!confirm) return;
    const c = confirm;
    setConfirm(null);
    if (c.kind === 'recipe') await doDeleteRecipe(c.id);
    if (c.kind === 'version') await doDeleteVersion(c.id);
    if (c.kind === 'component') await doDeleteComponent(c.id);
  };

  if (loading) {
    return (
      <div className="py-10 text-center text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
        Carregando receitas...
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-3xl font-semibold text-foreground">Receitas</h1>
        <p className="text-muted-foreground mt-1">
          Cadastre a massa e seus insumos. O peso total e o rendimento são calculados automaticamente.
        </p>
      </div>

      {/* Receitas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold">Nova Receita</h2>
          <Label htmlFor="receita-nome" className="sr-only">Nome da receita</Label>
          <Input
            id="receita-nome"
            value={newRecipe.nome}
            onChange={(e) => setNewRecipe({ nome: e.target.value })}
            placeholder="Ex: Brigadeiro 100% Cacau"
          />
          <Button onClick={addRecipe} className="w-full" disabled={savingRecipe || !newRecipe.nome.trim()}>
            {savingRecipe ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Criar receita
          </Button>
        </div>

        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold mb-3">Receitas Cadastradas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {recipes.map((r) => (
              <div
                key={r.id}
                className={`rounded-lg border p-3 transition flex items-center justify-between gap-2 ${
                  selectedRecipeId === r.id ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <button
                  onClick={() => setSelectedRecipeId(r.id)}
                  className="text-left flex-1"
                  aria-label={`Selecionar receita ${r.nome}`}
                  aria-pressed={selectedRecipeId === r.id}
                >
                  <p className="font-medium">{r.nome}</p>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => setConfirm({ kind: 'recipe', id: r.id, nome: r.nome })}
                  aria-label={`Excluir receita ${r.nome}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            {recipes.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma receita cadastrada.</p>}
          </div>
        </div>
      </div>

      {/* Ficha da massa */}
      {selectedRecipe && !selectedVersion && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold">Ficha da massa — {selectedRecipe.nome}</h2>
          <div className="rounded-lg border border-dashed border-border p-4 bg-muted/30 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium">Nenhuma ficha criada para essa receita.</p>
              <p className="text-sm text-muted-foreground">
                Crie a ficha para adicionar os insumos e calcular automaticamente o rendimento em 25g e 30g.
              </p>
            </div>
            <Button onClick={addFormula} disabled={savingFormula}>
              {savingFormula ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Criar ficha da massa
            </Button>
          </div>
        </div>
      )}

      {/* Insumos da massa */}
      {selectedVersion && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">
                  Ficha da massa{selectedRecipe ? ` — ${selectedRecipe.nome}` : ''}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Informe as quantidades da receita. O peso total considera automaticamente insumos em g, kg, ml e l.
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => setConfirm({ kind: 'version', id: selectedVersion.id, label: 'ficha da massa' })}
                aria-label="Excluir ficha da massa"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Peso total calculado</p>
              <p className="mt-1 font-display text-2xl font-semibold">
                {selectedVersionMass.totalGrams > 0 ? `${selectedVersionMass.totalGrams} g` : '—'}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Rendimento 25g</p>
              <p className="mt-1 font-display text-2xl font-semibold">
                {selectedVersionMass.totalGrams > 0 ? `≈ ${selectedVersionYields.tamanho25g}` : '—'}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">Rendimento 30g</p>
              <p className="mt-1 font-display text-2xl font-semibold">
                {selectedVersionMass.totalGrams > 0 ? `≈ ${selectedVersionYields.tamanho30g}` : '—'}
              </p>
            </div>
          </div>

          {selectedVersionMass.ignoredComponents > 0 && (
            <p className="text-xs text-warning">
              {selectedVersionMass.ignoredComponents} insumo(s) em unidade não conversível ficaram fora do peso total.
            </p>
          )}

          <div className="rounded-lg border border-dashed border-border p-4 bg-muted/30 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-6">
              <Label htmlFor="receita-componente-insumo" className="text-xs">Insumo</Label>
              <select
                id="receita-componente-insumo"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={newComponent.stock_item_id}
                onChange={(e) => {
                  const item = insumosStock.find((s) => s.id === e.target.value);
                  const baseUnit = (item?.unidade_base as Uom) || 'g';
                  const uom: Uom = UOM_OPTIONS.includes(baseUnit) ? baseUnit : 'g';
                  setNewComponent((p) => ({ ...p, stock_item_id: e.target.value, uom }));
                }}
              >
                <option value="">Selecione um insumo...</option>
                {insumosStock.map((si) => (
                  <option key={si.id} value={si.id}>{si.nome}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3">
              <Label htmlFor="receita-componente-quantidade" className="text-xs">Quantidade</Label>
              <Input
                id="receita-componente-quantidade"
                type="text"
                inputMode="decimal"
                value={newComponent.qty_per_batch}
                onChange={(e) => setNewComponent((p) => ({ ...p, qty_per_batch: e.target.value }))}
                placeholder="Ex: 395,5"
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="receita-componente-unidade" className="text-xs">Unidade</Label>
              <select
                id="receita-componente-unidade"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={newComponent.uom}
                onChange={(e) => setNewComponent((p) => ({ ...p, uom: e.target.value as Uom }))}
              >
                {UOM_OPTIONS.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-1">
              <Button onClick={addComponent} className="w-full" aria-label="Adicionar insumo à receita">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-left font-medium py-2 px-3">Insumo</th>
                  <th className="text-right font-medium py-2 px-3 w-32">Quantidade</th>
                  <th className="text-left font-medium py-2 px-3 w-24">Unidade</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {components.map((c) => {
                  const item = stockItems.find((s) => s.id === c.stock_item_id);
                  return (
                    <tr key={c.id} className="border-t border-border">
                      <td className="py-2 px-3 font-medium">{item?.nome || '—'}</td>
                      <td className="py-2 px-3 text-right tabular-nums">{c.qty_per_batch}</td>
                      <td className="py-2 px-3">{c.uom}</td>
                      <td className="py-2 px-3 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => setConfirm({ kind: 'component', id: c.id, label: item?.nome || 'insumo' })}
                          aria-label={`Remover insumo ${item?.nome || 'sem nome'}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {components.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-muted-foreground">
                      Nenhum insumo adicionado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AlertDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === 'recipe' && `Excluir a receita "${confirm.nome}"? Ela será ocultada da listagem.`}
              {confirm?.kind === 'version' && 'Excluir a ficha da massa? Os insumos vinculados serão removidos.'}
              {confirm?.kind === 'component' && `Remover o insumo "${confirm.label}" desta massa?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
