import { useState, useMemo } from 'react';
import { 
  DollarSign, 
  ShoppingBag, 
  Cookie, 
  TrendingUp,
  Calendar,
  History,
  CheckCircle2,
  Target,
  BarChart3,
  Users,
} from 'lucide-react';
import { StatCard } from '@/components/StatCard';
import { AlertaEstoqueBaixo } from '@/components/AlertaEstoqueBaixo';
import { usePedidos, getClienteDisplayName } from '@/hooks/usePedidos';
import { shouldGenerateRevenue } from '@/domain/pedidos';
import { useBrigadeiros } from '@/hooks/useBrigadeiros';
import { useTransacoes } from '@/hooks/useTransacoes';
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
import { parseISO } from 'date-fns';

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

const formatBRL = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

export function DashboardPage() {
  const { pedidos } = usePedidos();
  const { brigadeiros } = useBrigadeiros();
  const { transacoes } = useTransacoes();

  const currentYear = new Date().getFullYear();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');

  const [selectedYear, setSelectedYear] = useState<string>(String(currentYear));
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);

  const availableYears = useMemo(() => {
    const years: number[] = [];
    for (let year = currentYear; year >= 2022; year--) years.push(year);
    return years;
  }, [currentYear]);

  // --- Period helpers ---
  const inPeriod = (dateStr: string) => {
    const d = parseISO(dateStr);
    return String(d.getFullYear()) === selectedYear && String(d.getMonth() + 1).padStart(2, '0') === selectedMonth;
  };

  const filteredTransacoes = useMemo(() => transacoes.filter(t => inPeriod(t.data)), [transacoes, selectedYear, selectedMonth]);
  const filteredPedidos = useMemo(() => pedidos.filter(p => inPeriod(p.data)), [pedidos, selectedYear, selectedMonth]);

  // --- Basic stats ---
  const vendasPeriodo = filteredTransacoes.filter(t => t.tipo === 'entrada').reduce((a, t) => a + t.valor, 0);
  const despesasPeriodo = filteredTransacoes.filter(t => t.tipo === 'saida').reduce((a, t) => a + t.valor, 0);
  const lucroPeriodo = vendasPeriodo - despesasPeriodo;

  const vendasAnoSelecionado = useMemo(() =>
    transacoes.filter(t => t.tipo === 'entrada' && parseISO(t.data).getFullYear() === Number(selectedYear)).reduce((a, t) => a + t.valor, 0),
    [transacoes, selectedYear]);

  const vendasTotalHistorico = useMemo(() =>
    transacoes.filter(t => t.tipo === 'entrada').reduce((a, t) => a + t.valor, 0),
    [transacoes]);

  const totalBrigadeiros = filteredPedidos.reduce((acc, p) =>
    acc + (p.itens?.reduce((s, i) => s + i.quantidade, 0) || 0), 0);

  // --- Delivered orders ---
  const pedidosEntregues = useMemo(() => filteredPedidos.filter(p => shouldGenerateRevenue(p.status)), [filteredPedidos]);
  const pedidosEntreguesCount = pedidosEntregues.length;

  // --- Ticket Médio ---
  const receitaEntregues = pedidosEntregues.reduce((a, p) => a + p.valor_total, 0);
  const ticketMedio = pedidosEntreguesCount > 0 ? receitaEntregues / pedidosEntreguesCount : 0;

  // --- Taxa de Conversão ---
  const taxaConversao = filteredPedidos.length > 0 ? (pedidosEntreguesCount / filteredPedidos.length) * 100 : 0;

  // --- Top Clientes (from delivered orders) ---
  const topClientes = useMemo(() => {
    const map: Record<string, { nome: string; pedidos: number; valor: number }> = {};
    pedidosEntregues.forEach(p => {
      const key = p.cliente_id || p.cliente;
      if (!map[key]) map[key] = { nome: getClienteDisplayName(p), pedidos: 0, valor: 0 };
      map[key].pedidos += 1;
      map[key].valor += p.valor_total;
    });
    return Object.values(map).sort((a, b) => b.valor - a.valor).slice(0, 5);
  }, [pedidosEntregues]);

  // --- Top Produtos (quantity + revenue from delivered orders) ---
  const topProdutos = useMemo(() => {
    const map: Record<string, { nome: string; quantidade: number; receita: number }> = {};
    pedidosEntregues.forEach(p => {
      p.itens?.forEach(item => {
        const key = item.brigadeiro_id || item.brigadeiro_nome;
        if (!map[key]) map[key] = { nome: item.brigadeiro_nome, quantidade: 0, receita: 0 };
        map[key].quantidade += item.quantidade;
        map[key].receita += item.quantidade * item.preco_unitario;
      });
    });
    return Object.values(map).sort((a, b) => b.receita - a.receita);
  }, [pedidosEntregues]);

  // --- Sabores chart (all orders, quantity-based, like before) ---
  const saboresMaisVendidos = useMemo(() => {
    const countMap: Record<string, { nome: string; quantidade: number }> = {};
    filteredPedidos.forEach(p => {
      p.itens?.forEach(item => {
        const key = item.brigadeiro_id || item.brigadeiro_nome;
        if (!countMap[key]) countMap[key] = { nome: item.brigadeiro_nome, quantidade: 0 };
        countMap[key].quantidade += item.quantidade;
      });
    });
    const sorted = Object.values(countMap).sort((a, b) => b.quantidade - a.quantidade);
    const TOP_N = 8;
    let result: { nome: string; quantidade: number; cor: string }[];
    if (sorted.length <= TOP_N) {
      result = sorted.map((item, i) => ({ ...item, cor: COLORS[i % COLORS.length] }));
    } else {
      const top = sorted.slice(0, TOP_N);
      const outrosQtd = sorted.slice(TOP_N).reduce((s, i) => s + i.quantidade, 0);
      result = top.map((item, i) => ({ ...item, cor: COLORS[i % COLORS.length] }));
      result.push({ nome: 'Outros', quantidade: outrosQtd, cor: '#95A5A6' });
    }
    return result;
  }, [filteredPedidos]);

  const mesLabel = MESES.find(m => m.value === selectedMonth)?.label || '';

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
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Mês" /></SelectTrigger>
            <SelectContent>
              {MESES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[100px]"><SelectValue placeholder="Ano" /></SelectTrigger>
            <SelectContent>
              {availableYears.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Faturamento Histórico Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-primary/10"><Calendar className="h-6 w-6 text-primary" /></div>
          <div>
            <p className="text-sm text-muted-foreground">Faturamento {selectedYear}</p>
            <p className="text-2xl font-semibold text-foreground">{formatBRL(vendasAnoSelecionado)}</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-accent/50"><History className="h-6 w-6 text-accent-foreground" /></div>
          <div>
            <p className="text-sm text-muted-foreground">Faturamento Total (Histórico)</p>
            <p className="text-2xl font-semibold text-foreground">{formatBRL(vendasTotalHistorico)}</p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div>
        <h2 className="text-lg font-medium text-muted-foreground mb-3">{mesLabel} de {selectedYear}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          <StatCard title="Faturamento" value={formatBRL(vendasPeriodo)} subtitle="Total de entradas" icon={DollarSign} variant="primary" />
          <StatCard title="Pedidos" value={filteredPedidos.length} subtitle="Pedidos no período" icon={ShoppingBag} variant="default" />
          <StatCard title="Entregues" value={pedidosEntreguesCount} subtitle="Pedidos entregues" icon={CheckCircle2} variant="success" />
          <StatCard title="Ticket Médio" value={formatBRL(ticketMedio)} subtitle="Receita / entregues" icon={BarChart3} variant="default" />
          <StatCard title="Conversão" value={`${taxaConversao.toFixed(0)}%`} subtitle="Entregues / criados" icon={Target} variant={taxaConversao >= 70 ? 'success' : 'warning'} />
          <StatCard title="Despesas" value={formatBRL(despesasPeriodo)} subtitle="Total de saídas" icon={Cookie} variant="default" />
          <StatCard title="Lucro" value={formatBRL(lucroPeriodo)} subtitle="Entradas - Saídas" icon={TrendingUp} variant="success" />
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Financial Chart */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h3 className="font-display font-semibold text-lg mb-4">Resumo Financeiro - {mesLabel}/{selectedYear}</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { categoria: 'Entradas', valor: vendasPeriodo },
                { categoria: 'Saídas', valor: despesasPeriodo },
                { categoria: 'Lucro', valor: lucroPeriodo },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="categoria" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `R$${v.toLocaleString('pt-BR')}`} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} formatter={(value: number) => [formatBRL(value), 'Valor']} />
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
              <div className="h-[280px] flex-1 min-w-0">
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
                {(() => {
                  const total = saboresMaisVendidos.reduce((s, i) => s + i.quantidade, 0);
                  return saboresMaisVendidos.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.cor }} />
                      <span className="truncate flex-1">{item.nome}</span>
                      <span className="font-medium tabular-nums">{item.quantidade}</span>
                      <span className="text-muted-foreground tabular-nums w-12 text-right">
                        {total > 0 ? ((item.quantidade / total) * 100).toFixed(0) : 0}%
                      </span>
                    </div>
                  ));
                })()}
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
          {topProdutos.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topProdutos.slice(0, 10).map((p, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{p.nome}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.quantidade}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatBRL(p.receita)}</TableCell>
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
          {topClientes.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Pedidos</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topClientes.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.pedidos}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatBRL(c.valor)}</TableCell>
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
