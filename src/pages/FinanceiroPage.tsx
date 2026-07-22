import { useState } from 'react';
import { Plus, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Loader2, Wallet, History } from 'lucide-react';
import { Transacao } from '@/hooks/useTransacoes';
import { usePaginatedTransacoes } from '@/hooks/usePaginatedTransacoes';
import { useFinancialSummary } from '@/hooks/useFinancialSummary';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PaginationControls } from '@/components/PaginationControls';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { cn, formatCurrencyBRL, formatLocalDate } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  FINANCIAL_CONTROL_START_LABEL,
  getCategoriasTransacao,
  getTodasCategoriasTransacao,
  isCategoriaTransacaoValida,
  isFinancialControlDate,
} from '@/domain/financeiro';
import { parseDecimalInput } from '@/domain/numeros';

type TransacaoFormErrors = Partial<Record<'categoria' | 'descricao' | 'valor' | 'data', string>>;

export function FinanceiroPage() {
  const { summary, loading: loadingSummary, refetch: refetchSummary } = useFinancialSummary();
  // Paginated dataset for list
  const {
    transacoes, loading,
    page, setPage, totalPages, totalCount,
    tipoFilter, setTipoFilter,
    categoriaFilter, setCategoriaFilter,
    addTransacao,
  } = usePaginatedTransacoes();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState<TransacaoFormErrors>({});
  const [formData, setFormData] = useState({
    tipo: 'entrada' as Transacao['tipo'],
    categoria: '',
    descricao: '',
    valor: '',
    data: format(new Date(), 'yyyy-MM-dd'),
  });

  const totalEntradas = summary.totalEntradas;
  const totalSaidas = summary.totalSaidas;
  const lucroBruto = summary.lucroBruto;
  const totalHistorico = summary.totalHistorico;

  const handleAddTransacao = async () => {
    const valor = parseDecimalInput(formData.valor);
    const errors: TransacaoFormErrors = {};

    if (!isCategoriaTransacaoValida(formData.tipo, formData.categoria)) errors.categoria = 'Selecione uma categoria';
    if (!formData.descricao.trim()) errors.descricao = 'Informe uma descrição';
    if (!Number.isFinite(valor) || valor <= 0) errors.valor = 'Informe um valor maior que zero';
    if (!formData.data) errors.data = 'Informe uma data';
    if (formData.data && !isFinancialControlDate(formData.data)) {
      errors.data = `Use uma data a partir de ${FINANCIAL_CONTROL_START_LABEL}`;
    }

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast({ title: 'Revise os campos da transação', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const newTransacao = await addTransacao({
        tipo: formData.tipo,
        categoria: formData.categoria,
        descricao: formData.descricao.trim(),
        valor,
        data: formData.data,
      });
      await refetchSummary();
      if (!newTransacao) return;

      setIsDialogOpen(false);
      setFormData({
        tipo: 'entrada',
        categoria: '',
        descricao: '',
        valor: '',
        data: format(new Date(), 'yyyy-MM-dd'),
      });
      setFormErrors({});
    } finally {
      setSaving(false);
    }
  };

  const chartData = [
    { categoria: 'Entradas', valor: totalEntradas },
    { categoria: 'Saídas', valor: totalSaidas },
  ];
  const chartDescription = chartData
    .map(item => `${item.categoria}: ${formatCurrencyBRL(item.valor)}`)
    .join('; ');

  if (loading || loadingSummary) {
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
          <h1 className="font-display text-3xl font-semibold text-foreground">Financeiro</h1>
          <p className="text-muted-foreground mt-1">Controle oficial de receitas e despesas desde {FINANCIAL_CONTROL_START_LABEL}</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus size={18} />
              Nova Transação
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">Nova Transação</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="transacao-tipo">Tipo</Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(value: Transacao['tipo']) => {
                    setFormData({ ...formData, tipo: value, categoria: '' });
                    if (formErrors.categoria) setFormErrors({ ...formErrors, categoria: '' });
                  }}
                >
                  <SelectTrigger id="transacao-tipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada">Entrada</SelectItem>
                    <SelectItem value="saida">Saída</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="transacao-categoria">Categoria</Label>
                <Select
                  value={formData.categoria}
                  onValueChange={(value) => {
                    setFormData({ ...formData, categoria: value });
                    if (formErrors.categoria) setFormErrors({ ...formErrors, categoria: '' });
                  }}
                >
                  <SelectTrigger
                    id="transacao-categoria"
                    aria-invalid={!!formErrors.categoria}
                    aria-describedby={formErrors.categoria ? 'transacao-categoria-error' : undefined}
                  >
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {getCategoriasTransacao(formData.tipo).map((categoria) => (
                      <SelectItem key={categoria} value={categoria}>{categoria}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formErrors.categoria && <p id="transacao-categoria-error" className="text-xs text-destructive">{formErrors.categoria}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="transacao-descricao">Descrição</Label>
                <Input
                  id="transacao-descricao"
                  value={formData.descricao}
                  onChange={(e) => {
                    setFormData({ ...formData, descricao: e.target.value });
                    if (formErrors.descricao) setFormErrors({ ...formErrors, descricao: '' });
                  }}
                  placeholder="Descreva a transação"
                  aria-invalid={!!formErrors.descricao}
                  aria-describedby={formErrors.descricao ? 'transacao-descricao-error' : undefined}
                />
                {formErrors.descricao && <p id="transacao-descricao-error" className="text-xs text-destructive">{formErrors.descricao}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="transacao-valor">Valor (R$)</Label>
                  <Input
                    id="transacao-valor"
                    type="text"
                    inputMode="decimal"
                    value={formData.valor}
                    onChange={(e) => {
                      setFormData({ ...formData, valor: e.target.value });
                      if (formErrors.valor) setFormErrors({ ...formErrors, valor: '' });
                    }}
                    placeholder="Ex: 35,50"
                    aria-invalid={!!formErrors.valor}
                    aria-describedby={formErrors.valor ? 'transacao-valor-error' : undefined}
                  />
                  {formErrors.valor && <p id="transacao-valor-error" className="text-xs text-destructive">{formErrors.valor}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="transacao-data">Data</Label>
                  <Input
                    id="transacao-data"
                    type="date"
                    value={formData.data}
                    onChange={(e) => {
                      setFormData({ ...formData, data: e.target.value });
                      if (formErrors.data) setFormErrors({ ...formErrors, data: '' });
                    }}
                    aria-invalid={!!formErrors.data}
                    aria-describedby={formErrors.data ? 'transacao-data-error' : undefined}
                  />
                  {formErrors.data && <p id="transacao-data-error" className="text-xs text-destructive">{formErrors.data}</p>}
                </div>
              </div>
              <Button onClick={handleAddTransacao} className="w-full" disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Adicionar Transação
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Entradas</p>
              <p className="text-2xl font-display font-semibold text-success mt-1">
                {formatCurrencyBRL(totalEntradas)}
              </p>
            </div>
            <div className="p-3 bg-success/10 rounded-lg">
              <ArrowUpRight className="w-6 h-6 text-success" />
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Saídas</p>
              <p className="text-2xl font-display font-semibold text-destructive mt-1">
                {formatCurrencyBRL(totalSaidas)}
              </p>
            </div>
            <div className="p-3 bg-destructive/10 rounded-lg">
              <ArrowDownRight className="w-6 h-6 text-destructive" />
            </div>
          </div>
        </div>
        <div className="gradient-chocolate rounded-xl p-5 shadow-chocolate text-primary-foreground">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white/70">Lucro Bruto</p>
              <p className="text-2xl font-display font-semibold mt-1">
                {formatCurrencyBRL(lucroBruto)}
              </p>
            </div>
            <div className="p-3 bg-white/20 rounded-lg">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Histórico comercial</p>
              <p className="text-2xl font-display font-semibold text-foreground mt-1">
                {formatCurrencyBRL(totalHistorico)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Pedidos entregues até 31/07/2026</p>
            </div>
            <div className="p-3 bg-accent/50 rounded-lg">
              <History className="w-6 h-6 text-accent-foreground" />
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
        <h2 className="font-display font-semibold text-lg mb-4">Fluxo Financeiro</h2>
        <p className="sr-only">{chartDescription}</p>
        <div className="h-[300px]" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="categoria" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(value) => `R$${value.toLocaleString('pt-BR')}`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value: number) => [formatCurrencyBRL(value), '']}
              />
              <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h2 className="font-display font-semibold">Transações Recentes</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="w-full sm:w-[150px]" aria-label="Filtrar transações por tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                <SelectItem value="entrada">Entradas</SelectItem>
                <SelectItem value="saida">Saídas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoriaFilter} onValueChange={setCategoriaFilter}>
              <SelectTrigger className="w-full sm:w-[190px]" aria-label="Filtrar transações por categoria">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas categorias</SelectItem>
                {getTodasCategoriasTransacao().map((categoria) => (
                  <SelectItem key={categoria} value={categoria}>{categoria}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {transacoes.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <Wallet className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-display font-semibold text-lg text-foreground mb-1">Nenhuma transação registrada</h3>
            <p className="text-muted-foreground text-sm">
              {tipoFilter !== 'todos' || categoriaFilter !== 'todas'
                ? 'Tente ajustar os filtros.'
                : 'Registre sua primeira transação para começar o controle financeiro.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {transacoes.map((transacao) => (
              <div key={transacao.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-lg",
                    transacao.tipo === 'entrada' ? 'bg-success/10' : 'bg-destructive/10'
                  )}>
                    {transacao.tipo === 'entrada'
                      ? <TrendingUp className="w-4 h-4 text-success" />
                      : <TrendingDown className="w-4 h-4 text-destructive" />
                    }
                  </div>
                  <div>
                    <p className="font-medium">{transacao.descricao}</p>
                    <p className="text-sm text-muted-foreground">
                      {transacao.categoria} • {formatLocalDate(transacao.data, 'dd/MM/yyyy', { locale: ptBR })}
                    </p>
                  </div>
                </div>
                <p className={cn(
                  "font-semibold",
                  transacao.tipo === 'entrada' ? 'text-success' : 'text-destructive'
                )}>
                  {transacao.tipo === 'entrada' ? '+' : '-'} {formatCurrencyBRL(transacao.valor)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
      <PaginationControls page={page} totalPages={totalPages} totalCount={totalCount} onPageChange={setPage} />
    </div>
  );
}
