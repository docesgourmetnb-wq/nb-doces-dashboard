import { useMemo, useState } from 'react';
import { Plus, AlertTriangle, Package, Loader2, ArrowUpCircle, ArrowDownCircle, Trash2, Pencil, ShoppingCart } from 'lucide-react';
import { useInsumos, Insumo } from '@/hooks/useInsumos';
import { useEstoqueMassas, EstoqueMassa } from '@/hooks/useEstoqueMassas';
import { useEstoqueProdutos, EstoqueProduto } from '@/hooks/useEstoqueProdutos';
import { Brigadeiro, useBrigadeiros } from '@/hooks/useBrigadeiros';
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
import { cn, formatCurrencyBRL } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { getProdutoNomeBase, getProdutoTamanhoComercial, type ProdutoCategoriaInput } from '@/domain/produtos';
import { parseDecimalInput, parseIntegerInput } from '@/domain/numeros';
import { calculateInsumoEntry, getInsumoStockStatus } from '@/domain/estoque';

type InsumoFormErrors = Partial<Record<
  'nome' | 'unidade' | 'quantidade_minima',
  string
>>;

type InsumoEntryErrors = Partial<Record<
  'quantidade' | 'valor_total' | 'data_compra',
  string
>>;

type TamanhoProdutoFilter = 'todos' | '25g' | '30g';

const tamanhoProdutoFilters: Array<{ value: TamanhoProdutoFilter; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: '25g', label: '25g' },
  { value: '30g', label: '30g' },
];

function getTamanhoSortValue(tamanho: string | null) {
  return Number(tamanho?.replace(',', '.').replace(/g$/i, '') ?? Number.POSITIVE_INFINITY);
}

function getProdutoCatalogoNome(produto: { nome?: string | null | undefined }) {
  return produto.nome || '';
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
  const { insumos, loading, addInsumo, updateInsumo } = useInsumos();
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
    unidade: '',
    quantidade_minima: '',
  });
  const [entryFormData, setEntryFormData] = useState({
    quantidade: '',
    valor_total: '',
    data_compra: new Date().toISOString().slice(0, 10),
  });

  const insumosEmFalta = insumos.filter(i => getInsumoStockStatus(i.quantidade_atual, i.quantidade_minima).needsAttention);
  const valorTotalEstoque = insumos.reduce((acc, i) => acc + (i.quantidade_atual * i.preco_unitario), 0);

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
        unidade: '',
        quantidade_minima: '',
      });
    }
    setFormErrors({});
    setIsDialogOpen(true);
  };

  const handleOpenEntryDialog = (insumo: Insumo) => {
    setEntryInsumo(insumo);
    setEntryFormData({
      quantidade: '',
      valor_total: '',
      data_compra: new Date().toISOString().slice(0, 10),
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
          unidade: formData.unidade.trim(),
          quantidade_minima: quantidadeMinima,
        });
      } else {
        await addInsumo({
          nome: formData.nome.trim(),
          unidade: formData.unidade.trim(),
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

    const quantidadeEntrada = parseDecimalInput(entryFormData.quantidade);
    const valorTotalEntrada = entryFormData.valor_total.trim() ? parseDecimalInput(entryFormData.valor_total) : 0;
    const errors: InsumoEntryErrors = {};

    if (!Number.isFinite(quantidadeEntrada) || quantidadeEntrada <= 0) {
      errors.quantidade = 'Informe uma quantidade maior que zero';
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
      const entry = calculateInsumoEntry(
        entryInsumo.quantidade_atual,
        quantidadeEntrada,
        valorTotalEntrada,
      );
      await updateInsumo(entryInsumo.id, {
        quantidade_atual: entry.quantidadeAtual,
        preco_unitario: entry.precoUnitario || entryInsumo.preco_unitario,
        ultima_compra: entryFormData.data_compra,
      });
      setEntryDialogOpen(false);
    } finally {
      setEntrySaving(false);
    }
  };

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
                  <Input id="insumo-unidade" value={formData.unidade} onChange={(e) => {
                    setFormData({ ...formData, unidade: e.target.value });
                    if (formErrors.unidade) setFormErrors({ ...formErrors, unidade: '' });
                  }} placeholder="Ex: lata, kg" aria-invalid={!!formErrors.unidade} aria-describedby={formErrors.unidade ? 'insumo-unidade-error' : undefined} />
                  {formErrors.unidade && <p id="insumo-unidade-error" className="text-xs text-destructive">{formErrors.unidade}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="insumo-quantidade-minima">Quantidade Mínima</Label>
                  <Input id="insumo-quantidade-minima" type="text" inputMode="decimal" value={formData.quantidade_minima} onChange={(e) => {
                    setFormData({ ...formData, quantidade_minima: e.target.value });
                    if (formErrors.quantidade_minima) setFormErrors({ ...formErrors, quantidade_minima: '' });
                  }} placeholder="Ex: 2,5" aria-invalid={!!formErrors.quantidade_minima} aria-describedby={formErrors.quantidade_minima ? 'insumo-quantidade-minima-error' : undefined} />
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
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="insumo-entry-quantidade">Quantidade comprada</Label>
                <Input
                  id="insumo-entry-quantidade"
                  type="text"
                  inputMode="decimal"
                  value={entryFormData.quantidade}
                  onChange={(e) => {
                    setEntryFormData({ ...entryFormData, quantidade: e.target.value });
                    if (entryErrors.quantidade) setEntryErrors({ ...entryErrors, quantidade: '' });
                  }}
                  placeholder="Ex: 395"
                  aria-invalid={!!entryErrors.quantidade}
                  aria-describedby={entryErrors.quantidade ? 'insumo-entry-quantidade-error' : undefined}
                />
                {entryErrors.quantidade && <p id="insumo-entry-quantidade-error" className="text-xs text-destructive">{entryErrors.quantidade}</p>}
              </div>
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
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg"><Package className="text-primary w-5 h-5" /></div>
          <div><p className="text-sm text-muted-foreground">Itens Totais</p><p className="text-2xl font-display font-semibold">{insumos.length}</p></div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm flex items-center gap-3">
          <div className="p-2 bg-warning/20 rounded-lg"><AlertTriangle className="text-warning w-5 h-5" /></div>
          <div><p className="text-sm text-muted-foreground">Em Falta</p><p className="text-2xl font-display font-semibold">{insumosEmFalta.length}</p></div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Valor do Estoque</p>
          <p className="text-2xl font-display font-semibold mt-1">{formatCurrencyBRL(valorTotalEstoque)}</p>
        </div>
      </div>

      {insumos.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-lg text-foreground">Nenhum insumo</h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
          {insumos.map((insumo) => {
            const stockStatus = getInsumoStockStatus(insumo.quantidade_atual, insumo.quantidade_minima);
            return (
              <div
                key={insumo.id}
                className="w-full bg-card border border-border rounded-xl p-5 card-hover shadow-sm text-left"
              >
                <div className="flex justify-between gap-3 mb-3">
                  <h3 className="font-semibold font-display">{insumo.nome}</h3>
                  <div className="flex items-center gap-1">
                    {stockStatus.needsAttention && (
                      <span className={cn("px-2 py-1 rounded-full text-xs font-medium", stockStatus.status === 'critical' ? 'bg-destructive/20 text-destructive' : 'bg-warning/20 text-warning')}>
                        {stockStatus.status === 'critical' ? 'Crítico' : 'Baixo'}
                      </span>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenDialog(insumo)}
                      aria-label={`Editar cadastro do insumo ${insumo.nome}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex justify-between text-sm mb-2 text-muted-foreground">
                  <span>Atual: {insumo.quantidade_atual} {insumo.unidade}</span>
                  <span>{insumo.quantidade_minima > 0 ? `Mín: ${insumo.quantidade_minima}` : 'Mín: não definido'}</span>
                </div>
                <Progress value={stockStatus.progressValue} className="h-2 mb-4" />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">Último custo: {formatCurrencyBRL(insumo.preco_unitario || 0)} / {insumo.unidade}</p>
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
            );
          })}
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
  const [tamanhoProdutoFilter, setTamanhoProdutoFilter] = useState<TamanhoProdutoFilter>('todos');
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [actionProduto, setActionProduto] = useState<EstoqueProduto | null>(null);
  const [actionType, setActionType] = useState<'add'|'sub'>('add');
  const [actionValue, setActionValue] = useState('');
  const [deleteProdutoConfirm, setDeleteProdutoConfirm] = useState<EstoqueProduto | null>(null);
  const brigadeirosPorId = useMemo(() => {
    return new Map(brigadeiros.map((brigadeiro) => [brigadeiro.id, brigadeiro]));
  }, [brigadeiros]);

  // Filtrar quais brigadeiros ainda nao tem estoque cadastrado
  const availableBrigadeiros = useMemo(() => {
    return brigadeiros
      .filter((brigadeiro) => !produtos.some((produto) => produto.brigadeiro_id === brigadeiro.id))
      .filter((brigadeiro) => {
        const tamanho = getProdutoTamanhoComercial(brigadeiro);
        return tamanhoProdutoFilter === 'todos' || tamanho === tamanhoProdutoFilter;
      })
      .sort(sortByProdutoNomeETamanho);
  }, [brigadeiros, produtos, tamanhoProdutoFilter]);

  const produtosOrdenados = useMemo(() => {
    return [...produtos].sort((a, b) => sortByProdutoNomeETamanho(
      getProdutoFinalCatalogo(a, brigadeirosPorId),
      getProdutoFinalCatalogo(b, brigadeirosPorId),
    ));
  }, [produtos, brigadeirosPorId]);

  if (loading) return <div className="py-8 text-center text-muted-foreground"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />Carregando...</div>;

  const handleRegister = async () => {
    if (!brigadeiroId) return;
    const brig = availableBrigadeiros.find(b => b.id === brigadeiroId) || brigadeiros.find(b => b.id === brigadeiroId);
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
                {tamanhoProdutoFilters.map((filter) => (
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
