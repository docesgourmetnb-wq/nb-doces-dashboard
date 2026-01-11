import { 
  DollarSign, 
  ShoppingBag, 
  Cookie, 
  TrendingUp 
} from 'lucide-react';
import { StatCard } from '@/components/StatCard';
import { AlertaEstoqueBaixo } from '@/components/AlertaEstoqueBaixo';
import { vendasPorMes, saboresMaisVendidos, pedidos } from '@/data/mockData';
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
  Legend,
} from 'recharts';

export function DashboardPage() {
  const totalVendas = vendasPorMes.reduce((acc, curr) => acc + curr.vendas, 0);
  const totalPedidos = vendasPorMes.reduce((acc, curr) => acc + curr.pedidos, 0);
  const totalBrigadeiros = saboresMaisVendidos.reduce((acc, curr) => acc + curr.quantidade, 0);
  const lucroEstimado = totalVendas * 0.45; // 45% margin estimate

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
          title="Faturamento Mensal"
          value={`R$ ${(totalVendas / 6).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          subtitle="Média dos últimos 6 meses"
          icon={DollarSign}
          variant="primary"
          trend={{ value: 12, isPositive: true }}
        />
        <StatCard
          title="Pedidos no Mês"
          value={pedidos.length}
          subtitle="4 pedidos esta semana"
          icon={ShoppingBag}
          variant="default"
        />
        <StatCard
          title="Brigadeiros Produzidos"
          value={totalBrigadeiros.toLocaleString('pt-BR')}
          subtitle="Nos últimos 6 meses"
          icon={Cookie}
          variant="default"
        />
        <StatCard
          title="Lucro Estimado"
          value={`R$ ${(lucroEstimado / 6).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          subtitle="Margem média de 45%"
          icon={TrendingUp}
          variant="success"
          trend={{ value: 8, isPositive: true }}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Chart */}
        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          <h3 className="font-display font-semibold text-lg mb-4">Vendas por Período</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vendasPorMes}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="mes" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickFormatter={(value) => `R$${value / 1000}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR')}`, 'Vendas']}
                />
                <Bar 
                  dataKey="vendas" 
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
                  label={({ nome, percent }) => `${nome} ${(percent * 100).toFixed(0)}%`}
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
                  formatter={(value: number) => [value, 'Unidades']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Stock Alert */}
      <AlertaEstoqueBaixo />
    </div>
  );
}
