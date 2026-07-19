import { useState, useMemo } from 'react';
import { 
  DollarSign, 
  ShoppingBag, 
  Cookie, 
  TrendingUp,
  Calendar,
  CheckCircle2,
  Target,
  BarChart3,
  Users,
  Loader2,
  Factory,
  ClockAlert,
  WalletCards,
} from 'lucide-react';
import { StatCard } from '@/components/StatCard';
import { AlertaEstoqueBaixo } from '@/components/AlertaEstoqueBaixo';
import { useDashboardSummary } from '@/hooks/useDashboardSummary';
import { useProductionDemand } from '@/hooks/useProductionDemand';
import { useOrderAgenda } from '@/hooks/useOrderAgenda';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatCurrencyBRL, formatLocalDate } from '@/lib/utils';
import {
  ENTREGA_LABELS,
  getPedidoFinanceiroStatusLabel,
  getPedidoStatusLabel,
} from '@/domain/pedidos';

const COLORS = ['#5D3A1F', '#D4A574', '#8B5A2B', '#93C572', '#C4A35A', '#F4D03F', '#E67E22', '#8E44AD', '#2ECC71'];

const MESES = [
  { value: '01', label: 'Janeiro' },
  { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' },
  { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

const chartColor = (index: number) => COLORS[index % COLORS.length] || '#95A5A6';
const urgencyLabel = {
  atrasado: 'Atrasado',
  hoje: 'Hoje',
  proximo: 'Próximo',
} as const;
const urgencyClass = {
  atrasado: 'bg-destructive/10 text-destructive border-destructive/20',
  hoje: 'bg-warning/15 text-warning border-warning/25',
  proximo: 'bg-muted text-muted-foreground border-border',
} as const;
const agendaActionLabel = {
  cobrar_saldo: 'Cobrar saldo',
  separar_entrega: 'Separar entrega',
  produzir: 'Produzir',
} as const;
const agendaActionClass = {
  cobrar_saldo: 'border-warning/25 bg-warning/15 text-warning',
  separar_entrega: 'border-success/25 bg-success/15 text-success',
  produzir: 'border-info/25 bg-info/15 text-info',
} as const;

export function DashboardPage() {
  const currentYear = new Date().getFullYear();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');

  const [selectedYear, setSelectedYear] = useState<string>(String(currentYear));
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const { summary, loading } = useDashboardSummary(Number(selectedYear), Number(selectedMonth));
  const {
    items: productionDemand,
    totalUnidades: totalProductionDemand,
    totalCobertoPorEstoque,
    loading: loadingProductionDemand,
  } = useProductionDemand();
  const {
    items: orderAgenda,
    pedidosHoje,
    pedidosAtrasados,
    pedidosBloqueadosPorSaldo,
    loading: loadingOrderAgenda,
  } = useOrderAgenda();

  const availableYears = useMemo(() => {
    const years: number[] = [];
    for (let year = currentYear; year >= 2022; year--) years.push(year);
    return years;
  }, [currentYear]);

  const saboresMaisVendidos = useMemo(() => {
    const sorted = summary.saboresMaisVendidos;
    const TOP_N = 8;
    let result: { nome: string; quantidade: number; cor: string }[];
    if (sorted.length <= TOP_N) {
      result = sorted.map((item, i) => ({ ...item, cor: chartColor(i) }));
    } else {
      const top = sorted.slice(0, TOP_N);
      const outrosQtd = sorted.slice(TOP_N).reduce((s, i) => s + i.quantidade, 0);
      result = top.map((item, i) => ({ ...item, cor: chartColor(i) }));
      result.push({ nome: 'Outros', quantidade: outrosQtd, cor: '#95A5A6' });
    }
    return result;
  }, [summary.saboresMaisVendidos]);

  const mesLabel = MESES.find(m => m.value === selectedMonth)?.label || '';
  const resumoFinanceiroData = [
    { categoria: 'Entradas', valor: summary.vendasPeriodo },
    { categoria: 'Saídas', valor: summary.despesasPeriodo },
    { categoria: 'Lucro', valor: summary.lucroPeriodo },
  ];
  const resumoFinanceiroDescricao = resumoFinanceiroData
    .map(item => `${item.categoria}: ${formatCurrencyBRL(item.valor)}`)
    .join('; ');
  const totalSaboresVendidos = saboresMaisVendidos.reduce((s, i) => s + i.quantidade, 0);
  const saboresMaisVendidosDescricao = saboresMaisVendidos
    .map(item => `${item.nome}: ${item.quantidade} unidades`)
    .join('; ');
  const productionDemandSubtitle = totalCobertoPorEstoque > 0
    ? `${totalCobertoPorEstoque} un. cobertas pelo estoque`
    : 'A produzir após estoque pronto';

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
          <h1 className="font-display text-3xl font-semibold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Visão geral do seu negócio</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[140px]" aria-label="Selecionar mês do dashboard"><SelectValue placeholder="Mês" /></SelectTrigger>
            <SelectContent>
              {MESES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[100px]" aria-label="Selecionar ano do dashboard"><SelectValue placeholder="Ano" /></SelectTrigger>
            <SelectContent>
              {availableYears.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-medium text-muted-foreground mb-3">Operação de hoje</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <StatCard title="Entregas Hoje" value={pedidosHoje} subtitle="Pedidos abertos para hoje" icon={Calendar} variant={pedidosHoje > 0 ? 'warning' : 'default'} />
          <StatCard title="Atrasados" value={pedidosAtrasados} subtitle="Pedidos abertos vencidos" icon={ClockAlert} variant={pedidosAtrasados > 0 ? 'warning' : 'success'} />
          <StatCard title="Saldo Pendente" value={pedidosBloqueadosPorSaldo} subtitle="Prontos ainda não quitados" icon={WalletCards} variant={pedidosBloqueadosPorSaldo > 0 ? 'warning' : 'success'} />
          <StatCard title="Produção Pendente" value={`${totalProductionDemand} un.`} subtitle={productionDemandSubtitle} icon={Factory} variant={totalProductionDemand > 0 ? 'warning' : 'success'} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h3 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" /> Agenda de Entregas
          </h3>
          {loadingOrderAgenda ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : orderAgenda.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Itens</TableHead>
                  <TableHead className="text-right">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orderAgenda.map((pedido) => (
                  <TableRow key={pedido.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-medium">{pedido.cliente}</p>
                        <p className="text-xs text-muted-foreground">
                          {ENTREGA_LABELS[pedido.tipo_entrega as keyof typeof ENTREGA_LABELS]} • {getPedidoStatusLabel(pedido.status)} • {getPedidoFinanceiroStatusLabel(pedido.status_financeiro)}
                        </p>
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${agendaActionClass[pedido.acao]}`}>
                          {agendaActionLabel[pedido.acao]}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="tabular-nums">{formatLocalDate(pedido.data_entrega, 'dd/MM/yyyy')}</p>
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${urgencyClass[pedido.urgency]}`}>
                          {urgencyLabel[pedido.urgency]}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{pedido.itens_total} un.</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrencyBRL(pedido.saldo_restante)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-sm py-8 text-center">Nenhum pedido aberto na agenda.</p>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h3 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
            <Factory className="h-5 w-5 text-primary" /> Produção Pendente
          </h3>
          {loadingProductionDemand ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : productionDemand.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sabor</TableHead>
                  <TableHead className="text-right">Qtd pedida</TableHead>
                  <TableHead className="text-right">Estoque</TableHead>
                  <TableHead className="text-right">A produzir</TableHead>
                  <TableHead className="text-right">Nº pedidos</TableHead>
                  <TableHead className="text-right">Próxima entrega</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productionDemand.slice(0, 8).map((item) => (
                  <TableRow key={item.nome}>
                    <TableCell className="font-medium">{item.nome}</TableCell>
                    <TableCell className="text-right tabular-nums">{item.quantidadePedido} un.</TableCell>
                    <TableCell className="text-right tabular-nums">{item.estoqueDisponivel} un.</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{item.quantidade} un.</TableCell>
                    <TableCell className="text-right tabular-nums">{item.pedidos}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatLocalDate(item.proximaEntrega, 'dd/MM/yyyy')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-sm py-8 text-center">Nenhum pedido aguardando produção.</p>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-medium text-muted-foreground mb-3">Financeiro de {mesLabel} de {selectedYear}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatCard title="Receita do mês" value={formatCurrencyBRL(summary.vendasPeriodo)} subtitle="Entradas do período" icon={DollarSign} variant="primary" />
          <StatCard title="Despesas" value={formatCurrencyBRL(summary.despesasPeriodo)} subtitle="Total de saídas" icon={Cookie} variant="default" />
          <StatCard title="Lucro" value={formatCurrencyBRL(summary.lucroPeriodo)} subtitle="Entradas - Saídas" icon={TrendingUp} variant="success" />
          <StatCard title="Ticket Médio" value={formatCurrencyBRL(summary.ticketMedio)} subtitle="Receita / entregues" icon={BarChart3} variant="default" />
        </div>
      </div>

      <div>
        <h2 className="text-lg font-medium text-muted-foreground mb-3">Indicadores comerciais</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard title="Pedidos" value={summary.pedidosPeriodo} subtitle="Pedidos no período" icon={ShoppingBag} variant="default" />
          <StatCard title="Entregues" value={summary.pedidosEntregues} subtitle="Pedidos entregues" icon={CheckCircle2} variant="success" />
          <StatCard title="Conversão" value={`${summary.taxaConversao.toFixed(0)}%`} subtitle="Entregues / criados" icon={Target} variant={summary.taxaConversao >= 70 ? 'success' : 'warning'} />
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Financial Chart */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h3 className="font-display font-semibold text-lg mb-4">Resumo Financeiro - {mesLabel}/{selectedYear}</h3>
          <p className="sr-only">{resumoFinanceiroDescricao}</p>
          <div className="h-[300px]" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={resumoFinanceiroData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="categoria" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `R$${v.toLocaleString('pt-BR')}`} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} formatter={(value: number) => [formatCurrencyBRL(value), 'Valor']} />
                <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Flavors Chart */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h3 className="font-display font-semibold text-lg mb-4">Sabores Mais Vendidos</h3>
          {saboresMaisVendidos.length > 0 ? (
            <div className="flex flex-col lg:flex-row gap-4">
              <p className="sr-only">Total vendido no período: {totalSaboresVendidos} unidades. {saboresMaisVendidosDescricao}</p>
              <div className="h-[280px] flex-1 min-w-0" aria-hidden="true">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={saboresMaisVendidos} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="quantidade" nameKey="nome">
                      {saboresMaisVendidos.map((entry, i) => <Cell key={i} fill={entry.cor} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col gap-2 justify-center min-w-[180px]">
                {saboresMaisVendidos.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.cor }} />
                    <span className="truncate flex-1">{item.nome}</span>
                    <span className="font-medium tabular-nums">{item.quantidade}</span>
                    <span className="text-muted-foreground tabular-nums w-12 text-right">
                      {totalSaboresVendidos > 0 ? ((item.quantidade / totalSaboresVendidos) * 100).toFixed(0) : 0}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground">
              <p>Nenhuma venda registrada neste período</p>
            </div>
          )}
        </div>
      </div>

      {/* Top Produtos + Top Clientes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Produtos */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h3 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
            <Cookie className="h-5 w-5 text-primary" /> Top Produtos (Entregues)
          </h3>
          {summary.topProdutos.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.topProdutos.map((p, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{p.nome}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.quantidade}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrencyBRL(p.receita)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-sm py-8 text-center">Nenhum produto entregue neste período</p>
          )}
        </div>

        {/* Top Clientes */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h3 className="font-display font-semibold text-lg mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Top Clientes (Entregues)
          </h3>
          {summary.topClientes.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Pedidos</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.topClientes.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.pedidos}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrencyBRL(c.valor)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-sm py-8 text-center">Nenhum cliente com pedido entregue neste período</p>
          )}
        </div>
      </div>

      {/* Stock Alert */}
      <AlertaEstoqueBaixo />
    </div>
  );
}
