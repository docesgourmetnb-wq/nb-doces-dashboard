import type { PedidoStatus } from './pedidos';
import { isHistoricalOrder } from './financeiro.ts';

export interface AgendaPedidoInput {
  id: string;
  cliente: string;
  data?: string | null;
  data_entrega: string;
  tipo_entrega: string;
  status: PedidoStatus | string;
  status_financeiro: string;
  valor_total: number;
  saldo_restante: number;
  itens_total: number;
}

export type AgendaUrgency = 'atrasado' | 'hoje' | 'proximo';

export interface AgendaPedido extends AgendaPedidoInput {
  urgency: AgendaUrgency;
  bloqueadoPorSaldo: boolean;
  acao: AgendaAction;
}

export type AgendaAction = 'cobrar_saldo' | 'separar_entrega' | 'produzir';

export interface OrderAgendaSummary {
  items: AgendaPedido[];
  pedidosHoje: number;
  pedidosAtrasados: number;
  pedidosBloqueadosPorSaldo: number;
}

export function isPedidoNaAgenda(status: string) {
  return status !== 'entregue' && status !== 'cancelado';
}

export function isPedidoOperacionalNaAgenda(pedido: AgendaPedidoInput) {
  return isPedidoNaAgenda(pedido.status) && !isHistoricalOrder(pedido);
}

function getUrgency(dataEntrega: string, today: string): AgendaUrgency {
  if (dataEntrega < today) return 'atrasado';
  if (dataEntrega === today) return 'hoje';
  return 'proximo';
}

export function getAgendaAction(status: string, saldoRestante: number): AgendaAction {
  if (status === 'pronto' && saldoRestante > 0) return 'cobrar_saldo';
  if (status === 'pronto') return 'separar_entrega';
  return 'produzir';
}

export function buildOrderAgenda(pedidos: AgendaPedidoInput[], today: string, limit = 6): AgendaPedido[] {
  return buildOrderAgendaSummary(pedidos, today, limit).items;
}

export function buildOrderAgendaSummary(pedidos: AgendaPedidoInput[], today: string, limit = 6): OrderAgendaSummary {
  const sortedItems = pedidos
    .filter(isPedidoOperacionalNaAgenda)
    .map((pedido) => ({
      ...pedido,
      urgency: getUrgency(pedido.data_entrega, today),
      bloqueadoPorSaldo: pedido.status === 'pronto' && pedido.saldo_restante > 0,
      acao: getAgendaAction(pedido.status, pedido.saldo_restante),
    }))
    .sort((a, b) => a.data_entrega.localeCompare(b.data_entrega) || a.cliente.localeCompare(b.cliente));

  return {
    items: sortedItems.slice(0, limit),
    pedidosHoje: sortedItems.filter((item) => item.urgency === 'hoje').length,
    pedidosAtrasados: sortedItems.filter((item) => item.urgency === 'atrasado').length,
    pedidosBloqueadosPorSaldo: sortedItems.filter((item) => item.bloqueadoPorSaldo).length,
  };
}
