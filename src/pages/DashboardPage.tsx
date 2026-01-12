import { 
  DollarSign, 
  ShoppingBag, 
  Cookie, 
  TrendingUp 
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

const COLORS = ['#5D3A1F', '#D4A574', '#8B5A2B', '#93C572', '#C4A35A', '#F4D03F'];

export function DashboardPage() {
  const { pedidos } = usePedidos();
  const { brigadeiros } = useBrigadeiros();
  const { transacoes } = useTransacoes();

  // Calculate stats
  const totalVendas = transacoes
    .filter(t => t.tipo === 'entrada')
    .reduce((acc, t) => acc + t.valor, 0);

  const totalDespesas = transacoes
    .filter(t => t.tipo === 'saida')
    .reduce((acc, t) => acc + t.valor, 0);

  const lucroEstimado = totalVendas - totalDespesas;

  const totalBrigadeiros = pedidos.reduce((acc, p) => {
    return acc + (p.itens?.reduce((itemAcc, item) => itemAcc + item.quantidade, 0) || 0);
  }, 0);

  // Prepare chart data
  const vendasPorMes = [
    { mes: 'Vendas', vendas: totalVendas, pedidos: pedidos.length },
  ];

  const saboresMaisVendidos = brigadeiros.slice(0, 6).map((b, index) => ({
    nome: b.nome.split(' ').slice(0, 2).join(' '),
    quantidade: Math.floor(Math.random() * 100) + 10, // Mock data for now
    cor: COLORS[index % COLORS.length],
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-semibold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Visão geral do seu negócio</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Faturamento Total"
          value={`R$ ${totalVendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          subtitle="Total de entradas"
          icon={DollarSign}
          variant="primary"
        />
        <StatCard
          title="Total de Pedidos"
          value={pedidos.length}
          subtitle="Pedidos registrados"
          icon={ShoppingBag}
          variant="default"
        />
        <StatCard
          title="Produtos Cadastrados"
          value={brigadeiros.length}
          subtitle="Sabores disponíveis"
          icon={Cookie}
          variant="default"
        />
        <StatCard
          title="Lucro Estimado"
          value={`R$ ${lucroEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          subtitle="Entradas - Saídas"
          icon={TrendingUp}
          variant="success"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Chart */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h3 className="font-display font-semibold text-lg mb-4">Resumo Financeiro</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { categoria: 'Entradas', valor: totalVendas },
                { categoria: 'Saídas', valor: totalDespesas },
                { categoria: 'Lucro', valor: lucroEstimado },
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
          <h3 className="font-display font-semibold text-lg mb-4">Produtos Cadastrados</h3>
          {brigadeiros.length > 0 ? (
            <div className="h-[300px]">
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
                    label={({ nome }) => nome}
                    labelLine={false}
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
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              <p>Cadastre produtos para ver o gráfico</p>
            </div>
          )}
        </div>
      </div>

      {/* Stock Alert */}
      <AlertaEstoqueBaixo />
    </div>
  );
}
