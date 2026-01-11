export interface Brigadeiro {
  id: string;
  nome: string;
  tipo: 'tradicional' | 'gourmet' | 'premium';
  precoVenda: number;
  custoUnitario: number;
  margemLucro: number;
  descricao?: string;
  ativo: boolean;
}

export interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  email?: string;
}

export interface ItemPedido {
  brigadeiroId: string;
  brigadeiroNome: string;
  quantidade: number;
  precoUnitario: number;
}

export interface Pedido {
  id: string;
  cliente: string;
  data: Date;
  tipoPedido: 'encomenda' | 'pronta-entrega' | 'evento';
  itens: ItemPedido[];
  valorTotal: number;
  formaPagamento: 'pix' | 'cartao' | 'dinheiro' | 'transferencia';
  status: 'pendente' | 'em-producao' | 'pronto' | 'entregue' | 'cancelado';
  observacoes?: string;
}

export interface ProducaoDiaria {
  id: string;
  data: Date;
  brigadeiroId: string;
  brigadeiroNome: string;
  quantidade: number;
  custoTotal: number;
  status: 'planejado' | 'em-andamento' | 'concluido';
}

export interface Insumo {
  id: string;
  nome: string;
  unidade: string;
  quantidadeAtual: number;
  quantidadeMinima: number;
  consumoMedio: number;
  precoUnitario: number;
  ultimaCompra?: Date;
}

export interface TransacaoFinanceira {
  id: string;
  tipo: 'entrada' | 'saida';
  categoria: string;
  descricao: string;
  valor: number;
  data: Date;
  referencia?: string;
}
