import type { PedidoStatus } from './pedidos';

export interface ProductionDemandItemInput {
  brigadeiro_nome: string;
  quantidade: number;
}

export interface ProductionDemandPedidoInput {
  id: string;
  cliente: string;
  data_entrega: string;
  status: PedidoStatus | string;
  itens?: ProductionDemandItemInput[] | null;
}

export interface ProductionDemandItem {
  nome: string;
  quantidade: number;
  pedidos: number;
  proximaEntrega: string;
}

const PRODUCTION_STATUSES = new Set<string>(['confirmado', 'em-producao']);

export function isPedidoDemandante(status: string) {
  return PRODUCTION_STATUSES.has(status);
}

export function aggregateProductionDemand(pedidos: ProductionDemandPedidoInput[]): ProductionDemandItem[] {
  const demandByName = new Map<string, ProductionDemandItem & { pedidoIds: Set<string> }>();

  for (const pedido of pedidos) {
    if (!isPedidoDemandante(pedido.status)) continue;

    for (const item of pedido.itens || []) {
      if (!item.brigadeiro_nome || item.quantidade <= 0) continue;

      const current = demandByName.get(item.brigadeiro_nome) ?? {
        nome: item.brigadeiro_nome,
        quantidade: 0,
        pedidos: 0,
        proximaEntrega: pedido.data_entrega,
        pedidoIds: new Set<string>(),
      };

      current.quantidade += item.quantidade;
      current.pedidoIds.add(pedido.id);
      if (pedido.data_entrega < current.proximaEntrega) {
        current.proximaEntrega = pedido.data_entrega;
      }

      demandByName.set(item.brigadeiro_nome, current);
    }
  }

  return [...demandByName.values()]
    .map(({ pedidoIds, ...item }) => ({ ...item, pedidos: pedidoIds.size }))
    .sort((a, b) => a.proximaEntrega.localeCompare(b.proximaEntrega) || b.quantidade - a.quantidade);
}
