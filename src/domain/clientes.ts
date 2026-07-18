export interface ClienteReferencia {
  id: string;
  nome: string;
  email?: string | null;
  telefone?: string | null;
}

export interface PedidoClienteReferencia {
  cliente: string;
  cliente_id?: string | null;
}

export interface PedidoClienteStatsReferencia extends PedidoClienteReferencia {
  valor_total: number;
  data_entrega?: string | null;
  data?: string | null;
}

export interface ClientePedidoStats {
  totalPedidos: number;
  totalComercial: number;
  totalFinanceiroOficial: number;
  totalPedidosHistoricos: number;
  totalPedidosSemVinculo: number;
}

function normalizeClienteNome(nome: string) {
  return nome.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function normalizeClienteEmail(email: string | null | undefined) {
  return (email || '').toLowerCase().trim();
}

export function normalizeClienteTelefone(telefone: string | null | undefined) {
  return (telefone || '').replace(/\D/g, '');
}

export function findClienteByContato<TCliente extends ClienteReferencia>(
  clientes: TCliente[],
  contato: { email?: string | null; telefone?: string | null },
) {
  const email = normalizeClienteEmail(contato.email);
  const telefone = normalizeClienteTelefone(contato.telefone);

  if (!email && !telefone) return undefined;

  return clientes.find((cliente) => (
    (email && normalizeClienteEmail(cliente.email) === email) ||
    (telefone && normalizeClienteTelefone(cliente.telefone) === telefone)
  ));
}

export function getPedidosVinculadosAoCliente<TPedido extends PedidoClienteReferencia>(
  cliente: ClienteReferencia,
  pedidos: TPedido[],
) {
  return pedidos.filter((pedido) => pedido.cliente_id === cliente.id);
}

export function getPedidosSemVinculoComMesmoNome<TPedido extends PedidoClienteReferencia>(
  cliente: ClienteReferencia,
  pedidos: TPedido[],
) {
  const clienteNome = normalizeClienteNome(cliente.nome);
  return pedidos.filter((pedido) => (
    !pedido.cliente_id &&
    normalizeClienteNome(pedido.cliente) === clienteNome
  ));
}

export function getClientePedidoStats<TPedido extends PedidoClienteStatsReferencia>(
  cliente: ClienteReferencia,
  pedidos: TPedido[],
  isPedidoFinanceiroOficial: (pedido: TPedido) => boolean,
): ClientePedidoStats {
  const pedidosVinculados = getPedidosVinculadosAoCliente(cliente, pedidos);
  const pedidosSemVinculo = getPedidosSemVinculoComMesmoNome(cliente, pedidos);
  const pedidosFinanceiros = pedidosVinculados.filter(isPedidoFinanceiroOficial);

  return {
    totalPedidos: pedidosVinculados.length,
    totalComercial: pedidosVinculados.reduce((total, pedido) => total + pedido.valor_total, 0),
    totalFinanceiroOficial: pedidosFinanceiros.reduce((total, pedido) => total + pedido.valor_total, 0),
    totalPedidosHistoricos: pedidosVinculados.length - pedidosFinanceiros.length,
    totalPedidosSemVinculo: pedidosSemVinculo.length,
  };
}
