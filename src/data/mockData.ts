import { Brigadeiro, Pedido, ProducaoDiaria, Insumo, TransacaoFinanceira } from '@/types';

export const brigadeiros: Brigadeiro[] = [
  {
    id: '1',
    nome: 'Brigadeiro Tradicional',
    tipo: 'tradicional',
    precoVenda: 3.50,
    custoUnitario: 1.20,
    margemLucro: 65.7,
    descricao: 'O clássico que todo mundo ama',
    ativo: true,
  },
  {
    id: '2',
    nome: 'Brigadeiro de Ninho',
    tipo: 'gourmet',
    precoVenda: 5.00,
    custoUnitario: 1.80,
    margemLucro: 64.0,
    descricao: 'Feito com leite ninho de verdade',
    ativo: true,
  },
  {
    id: '3',
    nome: 'Brigadeiro de Pistache',
    tipo: 'premium',
    precoVenda: 7.50,
    custoUnitario: 3.20,
    margemLucro: 57.3,
    descricao: 'Sabor sofisticado com pistache importado',
    ativo: true,
  },
  {
    id: '4',
    nome: 'Brigadeiro de Limão Siciliano',
    tipo: 'gourmet',
    precoVenda: 5.50,
    custoUnitario: 2.00,
    margemLucro: 63.6,
    descricao: 'Refrescante e delicioso',
    ativo: true,
  },
  {
    id: '5',
    nome: 'Brigadeiro de Churros',
    tipo: 'gourmet',
    precoVenda: 5.00,
    custoUnitario: 1.70,
    margemLucro: 66.0,
    descricao: 'Com canela e doce de leite',
    ativo: true,
  },
  {
    id: '6',
    nome: 'Brigadeiro de Nutella',
    tipo: 'premium',
    precoVenda: 6.50,
    custoUnitario: 2.80,
    margemLucro: 56.9,
    descricao: 'Puro sabor de avelã',
    ativo: true,
  },
];

export const pedidos: Pedido[] = [
  {
    id: '1',
    cliente: 'Maria Silva',
    data: new Date('2024-01-10'),
    tipoPedido: 'encomenda',
    itens: [
      { brigadeiroId: '1', brigadeiroNome: 'Brigadeiro Tradicional', quantidade: 50, precoUnitario: 3.50 },
      { brigadeiroId: '2', brigadeiroNome: 'Brigadeiro de Ninho', quantidade: 30, precoUnitario: 5.00 },
    ],
    valorTotal: 325.00,
    formaPagamento: 'pix',
    status: 'entregue',
  },
  {
    id: '2',
    cliente: 'João Santos',
    data: new Date('2024-01-11'),
    tipoPedido: 'evento',
    itens: [
      { brigadeiroId: '3', brigadeiroNome: 'Brigadeiro de Pistache', quantidade: 100, precoUnitario: 7.50 },
      { brigadeiroId: '6', brigadeiroNome: 'Brigadeiro de Nutella', quantidade: 50, precoUnitario: 6.50 },
    ],
    valorTotal: 1075.00,
    formaPagamento: 'cartao',
    status: 'em-producao',
  },
  {
    id: '3',
    cliente: 'Ana Oliveira',
    data: new Date('2024-01-12'),
    tipoPedido: 'pronta-entrega',
    itens: [
      { brigadeiroId: '4', brigadeiroNome: 'Brigadeiro de Limão Siciliano', quantidade: 20, precoUnitario: 5.50 },
    ],
    valorTotal: 110.00,
    formaPagamento: 'dinheiro',
    status: 'pronto',
  },
  {
    id: '4',
    cliente: 'Carlos Mendes',
    data: new Date('2024-01-13'),
    tipoPedido: 'encomenda',
    itens: [
      { brigadeiroId: '1', brigadeiroNome: 'Brigadeiro Tradicional', quantidade: 100, precoUnitario: 3.50 },
      { brigadeiroId: '5', brigadeiroNome: 'Brigadeiro de Churros', quantidade: 50, precoUnitario: 5.00 },
    ],
    valorTotal: 600.00,
    formaPagamento: 'transferencia',
    status: 'pendente',
  },
];

export const producaoDiaria: ProducaoDiaria[] = [
  { id: '1', data: new Date('2024-01-15'), brigadeiroId: '1', brigadeiroNome: 'Brigadeiro Tradicional', quantidade: 100, custoTotal: 120.00, status: 'concluido' },
  { id: '2', data: new Date('2024-01-15'), brigadeiroId: '2', brigadeiroNome: 'Brigadeiro de Ninho', quantidade: 50, custoTotal: 90.00, status: 'concluido' },
  { id: '3', data: new Date('2024-01-16'), brigadeiroId: '3', brigadeiroNome: 'Brigadeiro de Pistache', quantidade: 30, custoTotal: 96.00, status: 'em-andamento' },
  { id: '4', data: new Date('2024-01-16'), brigadeiroId: '6', brigadeiroNome: 'Brigadeiro de Nutella', quantidade: 40, custoTotal: 112.00, status: 'planejado' },
];

export const insumos: Insumo[] = [
  { id: '1', nome: 'Leite Condensado', unidade: 'lata', quantidadeAtual: 15, quantidadeMinima: 20, consumoMedio: 5, precoUnitario: 7.50 },
  { id: '2', nome: 'Chocolate em Pó', unidade: 'kg', quantidadeAtual: 8, quantidadeMinima: 5, consumoMedio: 2, precoUnitario: 25.00 },
  { id: '3', nome: 'Manteiga', unidade: 'kg', quantidadeAtual: 3, quantidadeMinima: 5, consumoMedio: 1, precoUnitario: 45.00 },
  { id: '4', nome: 'Leite Ninho', unidade: 'lata', quantidadeAtual: 10, quantidadeMinima: 8, consumoMedio: 3, precoUnitario: 35.00 },
  { id: '5', nome: 'Pistache', unidade: 'kg', quantidadeAtual: 0.5, quantidadeMinima: 1, consumoMedio: 0.3, precoUnitario: 180.00 },
  { id: '6', nome: 'Nutella', unidade: 'pote', quantidadeAtual: 4, quantidadeMinima: 5, consumoMedio: 2, precoUnitario: 28.00 },
  { id: '7', nome: 'Granulado', unidade: 'kg', quantidadeAtual: 12, quantidadeMinima: 10, consumoMedio: 3, precoUnitario: 15.00 },
  { id: '8', nome: 'Forminhas', unidade: 'pacote', quantidadeAtual: 8, quantidadeMinima: 10, consumoMedio: 4, precoUnitario: 12.00 },
];

export const transacoes: TransacaoFinanceira[] = [
  { id: '1', tipo: 'entrada', categoria: 'Vendas', descricao: 'Pedido #1 - Maria Silva', valor: 325.00, data: new Date('2024-01-10') },
  { id: '2', tipo: 'entrada', categoria: 'Vendas', descricao: 'Pedido #3 - Ana Oliveira', valor: 110.00, data: new Date('2024-01-12') },
  { id: '3', tipo: 'saida', categoria: 'Insumos', descricao: 'Compra de leite condensado', valor: 150.00, data: new Date('2024-01-08') },
  { id: '4', tipo: 'saida', categoria: 'Insumos', descricao: 'Compra de chocolate em pó', valor: 75.00, data: new Date('2024-01-09') },
  { id: '5', tipo: 'saida', categoria: 'Embalagens', descricao: 'Forminhas e caixas', valor: 85.00, data: new Date('2024-01-07') },
  { id: '6', tipo: 'entrada', categoria: 'Vendas', descricao: 'Pedido #2 - João Santos (sinal)', valor: 500.00, data: new Date('2024-01-11') },
];

export const vendasPorMes = [
  { mes: 'Ago', vendas: 2800, pedidos: 18 },
  { mes: 'Set', vendas: 3200, pedidos: 22 },
  { mes: 'Out', vendas: 4100, pedidos: 28 },
  { mes: 'Nov', vendas: 5500, pedidos: 35 },
  { mes: 'Dez', vendas: 8200, pedidos: 52 },
  { mes: 'Jan', vendas: 4800, pedidos: 32 },
];

export const saboresMaisVendidos = [
  { nome: 'Tradicional', quantidade: 850, cor: '#5D3A1F' },
  { nome: 'Ninho', quantidade: 620, cor: '#D4A574' },
  { nome: 'Nutella', quantidade: 480, cor: '#8B5A2B' },
  { nome: 'Pistache', quantidade: 320, cor: '#93C572' },
  { nome: 'Churros', quantidade: 280, cor: '#C4A35A' },
  { nome: 'Limão', quantidade: 210, cor: '#F4D03F' },
];
