import { useState, useMemo } from 'react';
import { 
  DollarSign, 
  ShoppingBag, 
  Cookie, 
  TrendingUp,
  Calendar,
  History,
  CheckCircle2
} from 'lucide-react';
import { StatCard } from '@/components/StatCard';
import { AlertaEstoqueBaixo } from '@/components/AlertaEstoqueBaixo';
import { usePedidos } from '@/hooks/usePedidos';
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
import { format, parseISO, startOfYear, endOfYear, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

export function DashboardPage() {
  const { pedidos } = usePedidos();
  const { brigadeiros } = useBrigadeiros();
  const { transacoes } = useTransacoes();

  const currentYear = new Date().getFullYear();
  const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');

  const [selectedYear, setSelectedYear] = useState<string>(String(currentYear));
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);

  // Gerar lista de anos desde 2022 até o ano atual
  const availableYears = useMemo(() => {
    const startYear = 2022;
    const years: number[] = [];
    for (let year = currentYear; year >= startYear; year--) {
      years.push(year);
    }
    return years;
  }, [currentYear]);

  // Filtrar transações por período selecionado
  const filteredTransacoes = useMemo(() => {
    return transacoes.filter(t => {
      const date = parseISO(t.data);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return String(year) === selectedYear && month === selectedMonth;
    });
  }, [transacoes, selectedYear, selectedMonth]);

  // Filtrar pedidos por período selecionado
  const filteredPedidos = useMemo(() => {
    return pedidos.filter(p => {
      const date = parseISO(p.data);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      return String(year) === selectedYear && month === selectedMonth;
    });
  }, [pedidos, selectedYear, selectedMonth]);

  // Calcular stats do período filtrado
  const vendasPeriodo = filteredTransacoes
    .filter(t => t.tipo === 'entrada')
    .reduce((acc, t) => acc + t.valor, 0);

  const despesasPeriodo = filteredTransacoes
    .filter(t => t.tipo === 'saida')
    .reduce((acc, t) => acc + t.valor, 0);

  const lucroPeriodo = vendasPeriodo - despesasPeriodo;

  // Calcular faturamento do ano selecionado
  const vendasAnoSelecionado = useMemo(() => {
    return transacoes
      .filter(t => {
        const year = parseISO(t.data).getFullYear();
        return t.tipo === 'entrada' && year === Number(selectedYear);
      })
      .reduce((acc, t) => acc + t.valor, 0);
  }, [transacoes, selectedYear]);

  // Calcular faturamento total histórico
  const vendasTotalHistorico = useMemo(() => {
    return transacoes
      .filter(t => t.tipo === 'entrada')
      .reduce((acc, t) => acc + t.valor, 0);
  }, [transacoes]);

  const totalBrigadeiros = filteredPedidos.reduce((acc, p) => {
    return acc + (p.itens?.reduce((itemAcc, item) => itemAcc + item.quantidade, 0) || 0);
  }, 0);

  const pedidosEntregues = filteredPedidos.filter(p => p.status === 'entregue').length;

  // Agregar sabores mais vendidos a partir dos itens de pedido (período filtrado)
  const saboresMaisVendidos = useMemo(() => {
    const countMap: Record<string, { nome: string; quantidade: number }> = {};
    filteredPedidos.forEach(p => {
      p.itens?.forEach(item => {
        const key = item.brigadeiro_id || item.brigadeiro_nome;
        if (!countMap[key]) {
          countMap[key] = { nome: item.brigadeiro_nome, quantidade: 0 };
        }
        countMap[key].quantidade += item.quantidade;
      });
    });
    const sorted = Object.values(countMap).sort((a, b) => b.quantidade - a.quantidade);
    
    const TOP_N = 8;
    let result: { nome: string; quantidade: number; cor: string }[];
    
    if (sorted.length <= TOP_N) {
      result = sorted.map((item, index) => ({
        nome: item.nome,
        quantidade: item.quantidade,
        cor: COLORS[index % COLORS.length],
      }));
    } else {
      const top = sorted.slice(0, TOP_N);
      const outrosQtd = sorted.slice(TOP_N).reduce((s, i) => s + i.quantidade, 0);
      result = top.map((item, index) => ({
        nome: item.nome,
        quantidade: item.quantidade,
        cor: COLORS[index % COLORS.length],
      }));
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
        
        {/* Filtros */}
        <div className="flex gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              {MESES.map(mes => (
                <SelectItem key={mes.value} value={mes.value}>
                  {mes.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map(year => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Faturamento Histórico Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-primary/10">
            <Calendar className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Faturamento {selectedYear}</p>
            <p className="text-2xl font-semibold text-foreground">
              R$ {vendasAnoSelecionado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
        
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-lg bg-accent/50">
            <History className="h-6 w-6 text-accent-foreground" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Faturamento Total (Histórico)</p>
            <p className="text-2xl font-semibold text-foreground">
              R$ {vendasTotalHistorico.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid - Período Selecionado */}
      <div>
        <h2 className="text-lg font-medium text-muted-foreground mb-3">
          {mesLabel} de {selectedYear}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            title="Faturamento"
            value={`R$ ${vendasPeriodo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            subtitle="Total de entradas"
            icon={DollarSign}
            variant="primary"
          />
          <StatCard
            title="Pedidos"
            value={filteredPedidos.length}
            subtitle="Pedidos no período"
            icon={ShoppingBag}
            variant="default"
          />
          <StatCard
            title="Entregues"
            value={pedidosEntregues}
            subtitle="Pedidos entregues"
            icon={CheckCircle2}
            variant="success"
          />
          <StatCard
            title="Despesas"
            value={`R$ ${despesasPeriodo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            subtitle="Total de saídas"
            icon={Cookie}
            variant="default"
          />
          <StatCard
            title="Lucro"
            value={`R$ ${lucroPeriodo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
            subtitle="Entradas - Saídas"
            icon={TrendingUp}
            variant="success"
          />
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Chart */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h3 className="font-display font-semibold text-lg mb-4">
            Resumo Financeiro - {mesLabel}/{selectedYear}
          </h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { categoria: 'Entradas', valor: vendasPeriodo },
                { categoria: 'Saídas', valor: despesasPeriodo },
                { categoria: 'Lucro', valor: lucroPeriodo },
              ]}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="categoria" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickFormatter={(value) => `R$${value.toLocaleString('pt-BR')}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, 'Valor']}
                />
                <Bar 
                  dataKey="valor" 
                  fill="hsl(var(--primary))" 
                  radius={[4, 4, 0, 0]}
                />
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
                    <Pie
                      data={saboresMaisVendidos}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="quantidade"
                      nameKey="nome"
                    >
                      {saboresMaisVendidos.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.cor} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Legend */}
              <div className="flex flex-col gap-2 justify-center min-w-[180px]">
                {(() => {
                  const total = saboresMaisVendidos.reduce((s, i) => s + i.quantidade, 0);
                  return saboresMaisVendidos.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: item.cor }}
                      />
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

      {/* Stock Alert */}
      <AlertaEstoqueBaixo />
    </div>
  );
}
