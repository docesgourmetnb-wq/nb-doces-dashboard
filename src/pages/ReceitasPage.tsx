import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

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

  const [newRecipe, setNewRecipe] = useState({ nome: '' });
  const [savingRecipe, setSavingRecipe] = useState(false);
  const [newVersion, setNewVersion] = useState({ yield_qty: '', status: 'draft' as RecipeVersionRow['status'] });
  const [newComponent, setNewComponent] = useState({
    stock_item_id: '',
    qty_per_batch: '',
    uom: '',
    component_type: 'base' as RecipeComponentRow['component_type'],
    waste_factor: '0',
  });

  const loadBase = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [recipesRes, stockRes, insumosRes] = await Promise.all([
      supabase.from('recipes' as any).select('id,nome,tipo,ativo').order('nome'),
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
      .select('id,recipe_id,version_no,status,yield_qty')
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

  useEffect(() => {
    loadBase();
  }, [loadBase]);

  useEffect(() => {
    loadVersions();
  }, [loadVersions]);

  useEffect(() => {
    loadComponents();
  }, [loadComponents]);

  const selectedRecipe = useMemo(() => recipes.find((r) => r.id === selectedRecipeId), [recipes, selectedRecipeId]);

  /** Insumos disponíveis vêm direto do Estoque (tabela `insumos`). */
  const insumosStock = useMemo(
    () =>
      insumosEstoque.map((i) => ({
        id: i.id,
        nome: i.nome,
        unidade_base: i.unidade,
        tipo: 'insumo' as const,
      })),
    [insumosEstoque]
  );

  const addRecipe = async () => {
    const nome = newRecipe.nome.trim();
    if (!user) {
      toast({
        title: 'Sessão necessária',
        description: 'Entre na sua conta para criar receitas.',
        variant: 'destructive',
      });
      return;
    }
    if (!nome) {
      toast({
        title: 'Nome obrigatório',
        description: 'Digite um nome para a receita.',
        variant: 'destructive',
      });
      return;
    }

    setSavingRecipe(true);
    try {
      const row = {
        user_id: user.id,
        nome,
        yield_uom: 'lote',
      };

      // `consumo` exige migration 20260508100000; senão usamos `massa_base` (mesmo schema base).
      let { error } = await supabase.from('recipes' as any).insert({ ...row, tipo: 'consumo' });
      if (
        error &&
        (error.message.includes('consumo') ||
          error.message.toLowerCase().includes('invalid input value for enum'))
      ) {
        ({ error } = await supabase.from('recipes' as any).insert({ ...row, tipo: 'massa_base' }));
      }

      if (error) {
        toast({
          title: 'Erro ao criar receita',
          description:
            error.message.includes('relation') || error.message.includes('does not exist')
              ? 'Tabelas de receitas não encontradas no banco. Aplique as migrations no Supabase (recipes / stock_items).'
              : error.message,
          variant: 'destructive',
        });
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
    const yieldQty = parseFloat(newVersion.yield_qty);
    if (!yieldQty || yieldQty <= 0) return;

    const nextVersion = (versions[0]?.version_no || 0) + 1;
    const { error } = await supabase.from('recipe_versions' as any).insert({
      user_id: user.id,
      recipe_id: selectedRecipeId,
      version_no: nextVersion,
      status: newVersion.status,
      yield_qty: yieldQty,
    });
    if (error) {
      toast({ title: 'Erro ao criar versão', description: error.message, variant: 'destructive' });
      return;
    }
    setNewVersion({ yield_qty: '', status: 'draft' });
    await loadVersions();
    toast({ title: 'Versão criada' });
  };

  const addComponent = async () => {
    if (!user || !selectedVersionId || !newComponent.stock_item_id) return;
    const qty = parseFloat(newComponent.qty_per_batch);
    const waste = parseFloat(newComponent.waste_factor || '0');
    if (!qty || qty <= 0 || waste < 0 || waste >= 1) return;

    // O select usa o id do insumo (tabela `insumos`). Garantimos um stock_items equivalente.
    const insumo = insumosEstoque.find((i) => i.id === newComponent.stock_item_id);
    if (!insumo) {
      toast({ title: 'Insumo não encontrado', variant: 'destructive' });
      return;
    }

    let stockId: string | undefined = stockItems.find(
      (s) => s.tipo === 'insumo' && s.nome.toLowerCase() === insumo.nome.toLowerCase()
    )?.id;

    if (!stockId) {
      const { data: created, error: createErr } = await supabase
        .from('stock_items' as any)
        .insert({
          user_id: user.id,
          nome: insumo.nome,
          unidade_base: insumo.unidade,
          tipo: 'insumo',
        })
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
      component_type: newComponent.component_type,
      waste_factor: waste,
    });
    if (error) {
      toast({ title: 'Erro ao adicionar componente', description: error.message, variant: 'destructive' });
      return;
    }
    setNewComponent({
      stock_item_id: '',
      qty_per_batch: '',
      uom: '',
      component_type: 'base',
      waste_factor: '0',
    });
    await loadComponents();
    toast({ title: 'Componente adicionado' });
  };

  const setVersionActive = async (versionId: string) => {
    if (!selectedRecipeId) return;
    const { error: clearError } = await supabase
      .from('recipe_versions' as any)
      .update({ status: 'archived' })
      .eq('recipe_id', selectedRecipeId)
      .eq('status', 'active');

    if (clearError) {
      toast({ title: 'Erro ao ativar versão', description: clearError.message, variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('recipe_versions' as any).update({ status: 'active' }).eq('id', versionId);
    if (error) {
      toast({ title: 'Erro ao ativar versão', description: error.message, variant: 'destructive' });
      return;
    }
    await loadVersions();
    toast({ title: 'Versão ativa atualizada' });
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
          Cadastre o que cada produção consome de insumos. Na produção, o sistema baixa o estoque conforme a receita ativa.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <h2 className="font-semibold">Nova Receita</h2>
          <Input
            value={newRecipe.nome}
            onChange={(e) => setNewRecipe((prev) => ({ ...prev, nome: e.target.value }))}
            placeholder="Ex: Brigadeiro tradicional (referência)"
          />
          <Button
            type="button"
            onClick={addRecipe}
            className="w-full"
            disabled={savingRecipe || !newRecipe.nome.trim()}
          >
            {savingRecipe ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
            Criar receita
          </Button>
        </div>

        <div className="lg:col-span-2 bg-card border border-border rounded-xl p-4">
          <h2 className="font-semibold mb-3">Receitas Cadastradas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {recipes.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedRecipeId(r.id)}
                className={`text-left rounded-lg border p-3 transition ${selectedRecipeId === r.id ? 'border-primary bg-primary/5' : 'border-border'}`}
              >
                <p className="font-medium">{r.nome}</p>
              </button>
            ))}
            {recipes.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma receita cadastrada.</p>}
          </div>
        </div>
      </div>

      {selectedRecipe && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-4 space-y-3">
            <h2 className="font-semibold">Versões — {selectedRecipe.nome}</h2>
            <p className="text-sm text-muted-foreground">
              O rendimento de referência define o tamanho do &quot;lote&quot; usado para escalar o consumo de insumos quando você registra uma produção.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Input
                type="number"
                value={newVersion.yield_qty}
                onChange={(e) => setNewVersion((prev) => ({ ...prev, yield_qty: e.target.value }))}
                placeholder="Rendimento de referência (ex: 100 brigadeiros)"
              />
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={newVersion.status}
                onChange={(e) => setNewVersion((prev) => ({ ...prev, status: e.target.value as RecipeVersionRow['status'] }))}
              >
                <option value="draft">Rascunho</option>
                <option value="active">Ativa</option>
                <option value="archived">Arquivada</option>
              </select>
              <Button onClick={addVersion}>
                <Plus className="w-4 h-4 mr-2" /> Criar Versão
              </Button>
            </div>

            <div className="space-y-2">
              {versions.map((v) => (
                <div key={v.id} className={`border rounded-lg p-3 ${selectedVersionId === v.id ? 'border-primary bg-primary/5' : 'border-border'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button className="text-left" onClick={() => setSelectedVersionId(v.id)}>
                      <p className="font-medium">v{v.version_no} — lote de referência: {v.yield_qty}</p>
                      <p className="text-xs text-muted-foreground">Status: {v.status}</p>
                    </button>
                    {v.status !== 'active' && (
                      <Button variant="outline" size="sm" onClick={() => setVersionActive(v.id)}>
                        Definir ativa
                      </Button>
                    )}
                  </div>
                  {selectedVersionId === v.id && <p className="text-xs text-primary mt-2">ID para Produção: {v.id}</p>}
                </div>
              ))}
              {versions.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma versão para essa receita.</p>}
            </div>
          </div>

          {selectedVersionId && (
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <h2 className="font-semibold">Insumos desta versão</h2>
              <p className="text-sm text-muted-foreground">Quantidades por lote de referência (mesmo tamanho informado acima).</p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm md:col-span-2"
                  value={newComponent.stock_item_id}
                  onChange={(e) => {
                    const item = insumosStock.find((s) => s.id === e.target.value);
                    setNewComponent((prev) => ({
                      ...prev,
                      stock_item_id: e.target.value,
                      uom: item?.unidade_base || prev.uom,
                    }));
                  }}
                >
                  <option value="">Selecione um insumo...</option>
                  {insumosStock.map((si) => (
                    <option key={si.id} value={si.id}>{si.nome} ({si.unidade_base})</option>
                  ))}
                </select>
                <Input
                  type="number"
                  placeholder="Quantidade por lote"
                  value={newComponent.qty_per_batch}
                  onChange={(e) => setNewComponent((prev) => ({ ...prev, qty_per_batch: e.target.value }))}
                />
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="0.99"
                  placeholder="Perda extra (0–99%)"
                  value={newComponent.waste_factor}
                  onChange={(e) => setNewComponent((prev) => ({ ...prev, waste_factor: e.target.value }))}
                />
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <Label className="text-xs text-muted-foreground">Unidade</Label>
                  <p className="text-sm">{newComponent.uom || '-'}</p>
                </div>
                <Button onClick={addComponent}>
                  <Plus className="w-4 h-4 mr-2" /> Adicionar componente
                </Button>
              </div>

              <div className="space-y-2">
                {components.map((c) => {
                  const item = stockItems.find((s) => s.id === c.stock_item_id);
                  return (
                    <div key={c.id} className="border border-border rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium">{item?.nome || c.stock_item_id}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.qty_per_batch} {c.uom} por lote
                          {c.waste_factor > 0 ? ` · perda ${Math.round(c.waste_factor * 100)}%` : ''}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {components.length === 0 && <p className="text-sm text-muted-foreground">Nenhum componente na versão selecionada.</p>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
