export interface ClienteReferencia {
  id: string;
  nome: string;
}

export interface PedidoClienteReferencia {
  cliente: string;
  cliente_id?: string | null;
}

function normalizeClienteNome(nome: string) {
  return nome.toLowerCase().replace(/\s+/g, ' ').trim();
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
