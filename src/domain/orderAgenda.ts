import type { PedidoStatus } from './pedidos';

export interface AgendaPedidoInput {
  id: string;
  cliente: string;
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

export function isPedidoNaAgenda(status: string) {
  return status !== 'entregue' && status !== 'cancelado';
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
  return pedidos
    .filter((pedido) => isPedidoNaAgenda(pedido.status))
    .map((pedido) => ({
      ...pedido,
      urgency: getUrgency(pedido.data_entrega, today),
      bloqueadoPorSaldo: pedido.status === 'pronto' && pedido.saldo_restante > 0,
      acao: getAgendaAction(pedido.status, pedido.saldo_restante),
    }))
    .sort((a, b) => a.data_entrega.localeCompare(b.data_entrega) || a.cliente.localeCompare(b.cliente))
    .slice(0, limit);
}
