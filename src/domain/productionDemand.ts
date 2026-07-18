import type { PedidoStatus } from './pedidos';
import { normalizeProductionMatchName } from './producaoIntegrada.ts';

export interface ProductionDemandItemInput {
  brigadeiro_id?: string | null;
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
  brigadeiroId?: string | null;
  nome: string;
  quantidade: number;
  quantidadePedido: number;
  estoqueDisponivel: number;
  pedidos: number;
  proximaEntrega: string;
}

export interface ProductionStockItemInput {
  brigadeiro_id?: string | null;
  nome: string;
  quantidade: number;
}

const PRODUCTION_STATUSES = new Set<string>(['confirmado', 'em-producao']);

export function isPedidoDemandante(status: string) {
  return PRODUCTION_STATUSES.has(status);
}

function getDemandKey(item: ProductionDemandItemInput | ProductionStockItemInput) {
  const name = 'nome' in item ? item.nome : item.brigadeiro_nome;
  return item.brigadeiro_id || normalizeProductionMatchName(name);
}

export function aggregateProductionDemand(
  pedidos: ProductionDemandPedidoInput[],
  estoquePronto: ProductionStockItemInput[] = [],
): ProductionDemandItem[] {
  const demandByName = new Map<string, ProductionDemandItem & { pedidoIds: Set<string> }>();
  const stockByKey = new Map<string, number>();

  for (const item of estoquePronto) {
    const key = getDemandKey(item);
    if (!key || item.quantidade <= 0) continue;
    stockByKey.set(key, (stockByKey.get(key) || 0) + item.quantidade);
  }

  for (const pedido of pedidos) {
    if (!isPedidoDemandante(pedido.status)) continue;

    for (const item of pedido.itens || []) {
      if (!item.brigadeiro_nome || item.quantidade <= 0) continue;
      const key = getDemandKey(item);
      if (!key) continue;

      const current = demandByName.get(key) ?? {
        brigadeiroId: item.brigadeiro_id ?? null,
        nome: item.brigadeiro_nome,
        quantidade: 0,
        quantidadePedido: 0,
        estoqueDisponivel: 0,
        pedidos: 0,
        proximaEntrega: pedido.data_entrega,
        pedidoIds: new Set<string>(),
      };

      current.quantidadePedido += item.quantidade;
      current.pedidoIds.add(pedido.id);
      if (pedido.data_entrega < current.proximaEntrega) {
        current.proximaEntrega = pedido.data_entrega;
      }

      demandByName.set(key, current);
    }
  }

  return [...demandByName.values()]
    .map(({ pedidoIds, ...item }) => {
      const key = item.brigadeiroId || normalizeProductionMatchName(item.nome);
      const estoqueDisponivel = stockByKey.get(key) || 0;

      return {
        ...item,
        quantidade: Math.max(item.quantidadePedido - estoqueDisponivel, 0),
        estoqueDisponivel,
        pedidos: pedidoIds.size,
      };
    })
    .filter((item) => item.quantidade > 0)
    .sort((a, b) => a.proximaEntrega.localeCompare(b.proximaEntrega) || b.quantidade - a.quantidade);
}
