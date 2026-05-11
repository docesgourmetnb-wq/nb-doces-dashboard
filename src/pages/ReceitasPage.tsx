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
  const [newVersion, setNewVersion] = useState({
    peso_total_massa_g: '',
    peso_unitario_base_g: '20',
    status: 'draft' as RecipeVersionRow['status'],
  });
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
    const [recipesRes, stockRes, insumosRes] = await Promise.all([
      supabase
        .from('recipes' as any)
        .select('id,nome,tipo,ativo,deleted_at')
        .is('deleted_at', null)
        .order('nome'),
      supabase.from('stock_items' as any).select('id,nome,unidade_base,tipo').order('nome'),
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
      setRecipes((recipesRes.data || []) as unknown as RecipeRow[]);
      setStockItems((stockRes.data || []) as unknown as StockItemRow[]);
      setInsumosEstoque((insumosRes.data || []) as unknown as InsumoRow[]);
    }
    setLoading(false);
  }, [toast, user]);

  const loadVersions = useCallback(async () => {
    if (!selectedRecipeId) {
      setVersions([]);
      setSelectedVersionId('');
      return;
    }
    const { data, error } = await supabase
      .from('recipe_versions' as any)
      .select('id,recipe_id,version_no,status,yield_qty,peso_total_massa_g,peso_unitario_base_g')
      .eq('recipe_id', selectedRecipeId)
      .order('version_no', { ascending: false });
    if (error) {
      toast({ title: 'Erro ao carregar versões', description: error.message, variant: 'destructive' });
      return;
    }
    const list = (data || []) as unknown as RecipeVersionRow[];
    setVersions(list);
    if (!list.find((v) => v.id === selectedVersionId)) {
      setSelectedVersionId(list[0]?.id || '');
    }
  }, [selectedRecipeId, selectedVersionId, toast]);

  const loadComponents = useCallback(async () => {
    if (!selectedVersionId) {
      setComponents([]);
      return;
    }
    const { data, error } = await supabase
      .from('recipe_components' as any)
      .select('id,stock_item_id,qty_per_batch,uom,component_type,waste_factor')
      .eq('recipe_version_id', selectedVersionId)
      .order('sort_order');
    if (error) {
      toast({ title: 'Erro ao carregar componentes', description: error.message, variant: 'destructive' });
      return;
    }
    setComponents((data || []) as unknown as RecipeComponentRow[]);
  }, [selectedVersionId, toast]);

  useEffect(() => { loadBase(); }, [loadBase]);
  useEffect(() => { loadVersions(); }, [loadVersions]);
  useEffect(() => { loadComponents(); }, [loadComponents]);

  const selectedRecipe = useMemo(() => recipes.find((r) => r.id === selectedRecipeId), [recipes, selectedRecipeId]);
  const selectedVersion = useMemo(() => versions.find((v) => v.id === selectedVersionId), [versions, selectedVersionId]);

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
      const { error } = await supabase.from('recipes' as any).insert({
        user_id: user.id,
        nome,
        tipo: 'consumo',
        yield_uom: 'lote',
      });
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

  const addVersion = async () => {
    if (!user || !selectedRecipeId) return;
    const pesoTotal = parseFloat(newVersion.peso_total_massa_g);
    const pesoUnit = parseFloat(newVersion.peso_unitario_base_g);
    if (!pesoTotal || pesoTotal <= 0) {
      toast({ title: 'Informe o peso total da massa (g).', variant: 'destructive' });
      return;
    }
    if (!pesoUnit || pesoUnit <= 0) {
      toast({ title: 'Informe o peso unitário base (g).', variant: 'destructive' });
      return;
    }

    const nextVersion = (versions[0]?.version_no || 0) + 1;
    const { error } = await supabase.from('recipe_versions' as any).insert({
      user_id: user.id,
      recipe_id: selectedRecipeId,
      version_no: nextVersion,
      status: newVersion.status,
      yield_qty: pesoTotal, // compatibilidade
      peso_total_massa_g: pesoTotal,
      peso_unitario_base_g: pesoUnit,
    });
    if (error) {
      toast({ title: 'Erro ao criar versão', description: error.message, variant: 'destructive' });
      return;
    }
    setNewVersion({ peso_total_massa_g: '', peso_unitario_base_g: '20', status: 'draft' });
    await loadVersions();
    toast({ title: 'Versão criada' });
  };

  const addComponent = async () => {
    if (!user || !selectedVersionId || !newComponent.stock_item_id) return;
    const qty = parseFloat(newComponent.qty_per_batch);
    if (!qty || qty <= 0) return;

    const insumo = insumosEstoque.find((i) => i.id === newComponent.stock_item_id);
    if (!insumo) return;

    let stockId = stockItems.find(
      (s) => s.tipo === 'insumo' && s.nome.toLowerCase() === insumo.nome.toLowerCase()
    )?.id;

    if (!stockId) {
      const { data: created, error: createErr } = await supabase
        .from('stock_items' as any)
        .insert({ user_id: user.id, nome: insumo.nome, unidade_base: insumo.unidade, tipo: 'insumo' })
        .select('id,nome,unidade_base,tipo')
        .single();
      if (createErr || !created) {
        toast({ title: 'Erro ao vincular insumo', description: createErr?.message, variant: 'destructive' });
        return;
      }
      stockId = (created as any).id;
      setStockItems((prev) => [...prev, created as unknown as StockItemRow]);
    }

    const { error } = await supabase.from('recipe_components' as any).insert({
      user_id: user.id,
      recipe_version_id: selectedVersionId,
      stock_item_id: stockId,
      qty_per_batch: qty,
      uom: newComponent.uom,
      component_type: 'base',
      waste_factor: 0,
    });
    if (error) {
      toast({ title: 'Erro ao adicionar insumo', description: error.message, variant: 'destructive' });
      return;
    }
    setNewComponent({ stock_item_id: '', qty_per_batch: '', uom: 'g' });
    await loadComponents();
    toast({ title: 'Insumo adicionado' });
  };

  const setVersionActive = async (versionId: string) => {
    if (!selectedRecipeId) return;
    await supabase
      .from('recipe_versions' as any)
      .update({ status: 'archived' })
      .eq('recipe_id', selectedRecipeId)
      .eq('status', 'active');
    const { error } = await supabase.from('recipe_versions' as any).update({ status: 'active' }).eq('id', versionId);
    if (error) {
      toast({ title: 'Erro ao ativar versão', description: error.message, variant: 'destructive' });
      return;
    }
    await loadVersions();
    toast({ title: 'Versão ativa atualizada' });
  };

  // ===== Exclusões =====
  const doDeleteRecipe = async (id: string) => {
    const { error } = await supabase
      .from('recipes' as any)
      .update({ deleted_at: new Date().toISOString(), ativo: false })
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
        description: 'Existe produção vinculada a esta versão.',
        variant: 'destructive',
      });
      return;
    }

    // Apaga componentes primeiro
    await supabase.from('recipe_components' as any).delete().eq('recipe_version_id', id);
    const { error } = await supabase.from('recipe_versions' as any).delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao excluir versão', description: error.message, variant: 'destructive' });
      return;
    }
    if (selectedVersionId === id) setSelectedVersionId('');
    await loadVersions();
    toast({ title: 'Versão excluída' });
  };

  const doDeleteComponent = async (id: string) => {
    const { error } = await supabase.from('recipe_components' as any).delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao remover insumo', description: error.message, variant: 'destructive' });
      return;
    }
    await loadComponents();
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
          Cadastre a massa, seu peso total e os insumos. O rendimento é calculado automaticamente.
        </p>
      </div>

      {/* Receitas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold">Nova Receita</h2>
          <Input
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
                <button onClick={() => setSelectedRecipeId(r.id)} className="text-left flex-1">
                  <p className="font-medium">{r.nome}</p>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => setConfirm({ kind: 'recipe', id: r.id, nome: r.nome })}
                  aria-label="Excluir receita"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            {recipes.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma receita cadastrada.</p>}
          </div>
        </div>
      </div>

      {/* Versões */}
      {selectedRecipe && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Versões — {selectedRecipe.nome}</h2>
          </div>

          <div className="rounded-lg border border-dashed border-border p-4 space-y-3 bg-muted/30">
            <p className="text-sm font-medium">Nova versão</p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Peso total da massa (g)</Label>
                <Input
                  type="number"
                  value={newVersion.peso_total_massa_g}
                  onChange={(e) => setNewVersion((p) => ({ ...p, peso_total_massa_g: e.target.value }))}
                  placeholder="Ex: 500"
                />
              </div>
              <div>
                <Label className="text-xs">Peso unitário base (g)</Label>
                <Input
                  type="number"
                  value={newVersion.peso_unitario_base_g}
                  onChange={(e) => setNewVersion((p) => ({ ...p, peso_unitario_base_g: e.target.value }))}
                  placeholder="20"
                />
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={newVersion.status}
                  onChange={(e) =>
                    setNewVersion((p) => ({ ...p, status: e.target.value as RecipeVersionRow['status'] }))
                  }
                >
                  <option value="draft">Rascunho</option>
                  <option value="active">Ativa</option>
                  <option value="archived">Arquivada</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button onClick={addVersion} className="w-full">
                  <Plus className="w-4 h-4 mr-2" /> Criar versão
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Padrão: 20g por brigadeiro (receitas com cobertura). Tradicionais ficam em ~25g.
            </p>
          </div>

          <div className="space-y-2">
            {versions.map((v) => {
              const pt = Number(v.peso_total_massa_g ?? v.yield_qty ?? 0);
              const pu = Number(v.peso_unitario_base_g ?? 20);
              const rendimento = pu > 0 ? Math.floor(pt / pu) : 0;
              const isSelected = selectedVersionId === v.id;
              return (
                <div
                  key={v.id}
                  className={`border rounded-lg p-4 transition ${
                    isSelected ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button className="text-left flex-1" onClick={() => setSelectedVersionId(v.id)}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">v{v.version_no}</span>
                        <span
                          className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${
                            v.status === 'active'
                              ? 'bg-primary/15 text-primary'
                              : v.status === 'draft'
                              ? 'bg-muted text-muted-foreground'
                              : 'bg-secondary text-secondary-foreground'
                          }`}
                        >
                          {v.status}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                        <span><span className="text-muted-foreground">Massa:</span> <strong>{pt} g</strong></span>
                        <span><span className="text-muted-foreground">Unitário:</span> <strong>{pu} g</strong></span>
                        <span><span className="text-muted-foreground">Rendimento:</span> <strong>≈ {rendimento} brigadeiros</strong></span>
                      </div>
                    </button>
                    <div className="flex items-center gap-2">
                      {v.status !== 'active' && (
                        <Button variant="outline" size="sm" onClick={() => setVersionActive(v.id)}>
                          Definir ativa
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setConfirm({ kind: 'version', id: v.id, label: `v${v.version_no}` })}
                        aria-label="Excluir versão"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
            {versions.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma versão para essa receita.</p>}
          </div>
        </div>
      )}

      {/* Insumos da versão */}
      {selectedVersion && (
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div>
            <h2 className="font-semibold">Insumos da versão</h2>
            <p className="text-sm text-muted-foreground">
              Quantidades para produzir os <strong>{selectedVersion.peso_total_massa_g ?? selectedVersion.yield_qty} g</strong> de massa desta versão.
            </p>
          </div>

          <div className="rounded-lg border border-dashed border-border p-4 bg-muted/30 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-6">
              <Label className="text-xs">Insumo</Label>
              <select
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
              <Label className="text-xs">Quantidade</Label>
              <Input
                type="number"
                value={newComponent.qty_per_batch}
                onChange={(e) => setNewComponent((p) => ({ ...p, qty_per_batch: e.target.value }))}
                placeholder="Ex: 395"
              />
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Unidade</Label>
              <select
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
              <Button onClick={addComponent} className="w-full" aria-label="Adicionar">
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
                          aria-label="Remover insumo"
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
              {confirm?.kind === 'version' && `Excluir a versão ${confirm.label}? Os insumos vinculados serão removidos.`}
              {confirm?.kind === 'component' && `Remover o insumo "${confirm.label}" desta versão?`}
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
