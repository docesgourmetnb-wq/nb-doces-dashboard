import { useState } from 'react';
import { Plus, AlertTriangle, Package, Loader2, ArrowRight, ArrowLeft, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { useInsumos, Insumo } from '@/hooks/useInsumos';
import { useEstoqueMassas, EstoqueMassa } from '@/hooks/useEstoqueMassas';
import { useEstoqueProdutos, EstoqueProduto } from '@/hooks/useEstoqueProdutos';
import { useBrigadeiros } from '@/hooks/useBrigadeiros';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';

function InsumosTab() {
  const { insumos, loading, addInsumo, updateInsumo, deleteInsumo } = useInsumos();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingInsumo, setEditingInsumo] = useState<Insumo | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    nome: '',
    unidade: '',
    quantidade_atual: '',
    quantidade_minima: '',
    consumo_medio: '',
    preco_unitario: '',
  });

  const insumosEmFalta = insumos.filter(i => i.quantidade_atual <= i.quantidade_minima);
  const valorTotalEstoque = insumos.reduce((acc, i) => acc + (i.quantidade_atual * i.preco_unitario), 0);

  const handleOpenDialog = (insumo?: Insumo) => {
    if (insumo) {
      setEditingInsumo(insumo);
      setFormData({
        nome: insumo.nome,
        unidade: insumo.unidade,
        quantidade_atual: insumo.quantidade_atual.toString(),
        quantidade_minima: insumo.quantidade_minima.toString(),
        consumo_medio: insumo.consumo_medio.toString(),
        preco_unitario: insumo.preco_unitario.toString(),
      });
    } else {
      setEditingInsumo(null);
      setFormData({
        nome: '',
        unidade: '',
        quantidade_atual: '',
        quantidade_minima: '',
        consumo_medio: '',
        preco_unitario: '',
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    if (editingInsumo) {
      await updateInsumo(editingInsumo.id, {
        nome: formData.nome,
        unidade: formData.unidade,
        quantidade_atual: parseFloat(formData.quantidade_atual),
        quantidade_minima: parseFloat(formData.quantidade_minima),
        consumo_medio: parseFloat(formData.consumo_medio),
        preco_unitario: parseFloat(formData.preco_unitario),
      });
    } else {
      await addInsumo({
        nome: formData.nome,
        unidade: formData.unidade,
        quantidade_atual: parseFloat(formData.quantidade_atual),
        quantidade_minima: parseFloat(formData.quantidade_minima),
        consumo_medio: parseFloat(formData.consumo_medio),
        preco_unitario: parseFloat(formData.preco_unitario),
      });
    }
    setSaving(false);
    setIsDialogOpen(false);
  };

  const getStockStatus = (insumo: Insumo) => {
    const ratio = insumo.quantidade_atual / insumo.quantidade_minima;
    if (ratio < 0.5) return { status: 'critical', color: 'bg-destructive' };
    if (ratio <= 1) return { status: 'low', color: 'bg-warning' };
    return { status: 'ok', color: 'bg-success' };
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

      {/* Dialog omitido externamente por simplificacao, mas renderizado condicionalmente se precisasse */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">
                {editingInsumo ? 'Editar Insumo' : 'Novo Insumo'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} placeholder="Ex: Leite Condensado" />
                </div>
                <div className="space-y-2">
                  <Label>Unidade</Label>
                  <Input value={formData.unidade} onChange={(e) => setFormData({ ...formData, unidade: e.target.value })} placeholder="Ex: lata, kg" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantidade Atual</Label>
                  <Input type="number" step="0.1" value={formData.quantidade_atual} onChange={(e) => setFormData({ ...formData, quantidade_atual: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Quantidade Mínima</Label>
                  <Input type="number" step="0.1" value={formData.quantidade_minima} onChange={(e) => setFormData({ ...formData, quantidade_minima: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Consumo Médio/Sem.</Label>
                  <Input type="number" step="0.1" value={formData.consumo_medio} onChange={(e) => setFormData({ ...formData, consumo_medio: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Preço Unitário (R$)</Label>
                  <Input type="number" step="0.01" value={formData.preco_unitario} onChange={(e) => setFormData({ ...formData, preco_unitario: e.target.value })} />
                </div>
              </div>
              <Button onClick={handleSave} className="w-full" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {editingInsumo ? 'Salvar Alterações' : 'Adicionar Insumo'}
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
          <p className="text-2xl font-display font-semibold mt-1">R$ {valorTotalEstoque.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
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
            const stockStatus = getStockStatus(insumo);
            const progressValue = Math.min((insumo.quantidade_atual / insumo.quantidade_minima) * 100, 100);
            return (
              <div key={insumo.id} onClick={() => handleOpenDialog(insumo)} className="bg-card border border-border rounded-xl p-5 card-hover cursor-pointer shadow-sm">
                <div className="flex justify-between mb-3">
                  <h3 className="font-semibold font-display">{insumo.nome}</h3>
                  {stockStatus.status !== 'ok' && (
                    <span className={cn("px-2 py-1 rounded-full text-xs font-medium", stockStatus.status === 'critical' ? 'bg-destructive/20 text-destructive' : 'bg-warning/20 text-warning')}>
                      {stockStatus.status === 'critical' ? 'Crítico' : 'Baixo'}
                    </span>
                  )}
                </div>
                <div className="flex justify-between text-sm mb-2 text-muted-foreground">
                  <span>Atual: {insumo.quantidade_atual} {insumo.unidade}</span>
                  <span>Mín: {insumo.quantidade_minima}</span>
                </div>
                <Progress value={progressValue} className="h-2 mb-4" />
                <p className="text-sm text-muted-foreground">R$ {insumo.preco_unitario?.toFixed(2) || '0.00'} / un</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MassasTab() {
  const { massas, loading, addMassa, updateQuantidade } = useEstoqueMassas();
  const [sabor, setSabor] = useState('');
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [actionMassa, setActionMassa] = useState<EstoqueMassa | null>(null);
  const [actionType, setActionType] = useState<'add'|'sub'>('add');
  const [actionValue, setActionValue] = useState('');

  if (loading) return <div className="py-8 text-center text-muted-foreground"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />Carregando...</div>;

  const handleRegister = async () => {
    if (!sabor.trim()) return;
    await addMassa(sabor.trim(), 0);
    setSabor('');
    setIsRegisterOpen(false);
  };

  const handleAction = async () => {
    if (!actionMassa || !actionValue) return;
    const val = parseFloat(actionValue);
    if (isNaN(val) || val <= 0) return toast({ title: 'Valor inválido', variant: 'destructive' });
    
    const delta = actionType === 'add' ? val : -val;
    await updateQuantidade(actionMassa.id, delta);
    setActionMassa(null);
    setActionValue('');
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
                <Label>Sabor da Massa</Label>
                <Input value={sabor} onChange={(e) => setSabor(e.target.value)} placeholder="Ex: Chocolate ao Leite" />
              </div>
              <Button onClick={handleRegister} className="w-full">Registrar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card border border-border p-4 rounded-xl flex items-center justify-between mb-6 shadow-sm">
         <span className="text-muted-foreground font-medium">Estoque Total de Massas</span>
         <span className="text-2xl font-display font-bold">{(totalGeral/1000).toFixed(2)} kg</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {massas.map(massa => (
          <div key={massa.id} className="bg-card border border-border rounded-xl p-5 shadow-sm">
             <h3 className="font-display font-semibold text-lg mb-4">{massa.sabor}</h3>
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
              <Label>Quantidade (Gramas g)</Label>
              <Input type="number" value={actionValue} onChange={e => setActionValue(e.target.value)} placeholder="Ex: 500" />
            </div>
            <Button onClick={handleAction} className="w-full" variant={actionType === 'add' ? 'default' : 'destructive'}>
              Confirmar {actionType === 'add' ? 'Entrada' : 'Saída'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProdutosTab() {
  const { produtos, loading, addProduto, updateQuantidade } = useEstoqueProdutos();
  const { brigadeiros } = useBrigadeiros();
  const [brigadeiroId, setBrigadeiroId] = useState('');
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [actionProduto, setActionProduto] = useState<EstoqueProduto | null>(null);
  const [actionType, setActionType] = useState<'add'|'sub'>('add');
  const [actionValue, setActionValue] = useState('');

  if (loading) return <div className="py-8 text-center text-muted-foreground"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />Carregando...</div>;

  const handleRegister = async () => {
    if (!brigadeiroId) return;
    const brig = availableBrigadeiros.find(b => b.id === brigadeiroId) || brigadeiros.find(b => b.id === brigadeiroId);
    await addProduto(brigadeiroId, 0, brig?.nome || 'Produto Sem Nome');
    setBrigadeiroId('');
    setIsRegisterOpen(false);
  };

  const handleAction = async () => {
    if (!actionProduto || !actionValue) return;
    const val = parseInt(actionValue);
    if (isNaN(val) || val <= 0) return toast({ title: 'Valor inválido', variant: 'destructive' });
    
    const delta = actionType === 'add' ? val : -val;
    await updateQuantidade(actionProduto.id, delta);
    setActionProduto(null);
    setActionValue('');
  };

  // Filtrar quais brigadeiros ainda nao tem estoque cadastrado
  const availableBrigadeiros = brigadeiros.filter(b => !produtos.some(p => p.brigadeiro_id === b.id));

  const totalUnidades = produtos.reduce((acc, p) => acc + p.quantidade_un, 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b border-border pb-4">
        <div>
           <h2 className="text-xl font-display font-semibold">Produtos Finais (Prontos)</h2>
           <p className="text-muted-foreground text-sm">Controle de brigadeiros já enrolados e prontos para entrega</p>
        </div>
        <Dialog open={isRegisterOpen} onOpenChange={setIsRegisterOpen}>
          <DialogTrigger asChild><Button><Plus size={18} className="mr-2" /> Novo Produto no Estoque</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Acompanhar Novo Produto</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Produto Base</Label>
                <select className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2" value={brigadeiroId} onChange={e => setBrigadeiroId(e.target.value)}>
                   <option value="">Selecione um produto...</option>
                   {availableBrigadeiros.map(b => (
                     <option key={b.id} value={b.id}>{b.nome}</option>
                   ))}
                </select>
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
        {produtos.map(produto => (
          <div key={produto.id} className="bg-card border border-border rounded-xl p-5 shadow-sm">
             <h3 className="font-display font-semibold text-lg mb-4">{produto.brigadeiro?.nome || 'Carregando...'}</h3>
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
                   <ArrowDownCircle className="w-4 h-4 mr-2" /> Venda (-un)
                </Button>
             </div>
          </div>
        ))}
        {produtos.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground">Nenhum produto cadastrado no controle. Clique em Novo Produto para começar.</div>
        )}
      </div>

      {/* Action Dialog */}
      <Dialog open={!!actionProduto} onOpenChange={(open) => !open && setActionProduto(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{actionType === 'add' ? 'Registrar Produção Pronta' : 'Registrar Saída/Venda'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Produto: <strong>{actionProduto?.brigadeiro?.nome}</strong></p>
            <div className="space-y-2">
              <Label>Quantidade (Unidades)</Label>
              <Input type="number" value={actionValue} onChange={e => setActionValue(e.target.value)} placeholder="Ex: 50" />
            </div>
            <Button onClick={handleAction} className="w-full" variant={actionType === 'add' ? 'default' : 'destructive'}>
              Confirmar {actionType === 'add' ? 'Entrada' : 'Saída'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
