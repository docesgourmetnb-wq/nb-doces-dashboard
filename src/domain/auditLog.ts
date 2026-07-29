import { getPedidoStatusLabel } from './pedidos.ts';

export type AuditMetadataValue = string | number | boolean | null | AuditMetadataRecord | AuditMetadataValue[];
export interface AuditMetadataRecord {
  [key: string]: AuditMetadataValue | undefined;
}

const ACTION_LABELS: Record<string, string> = {
  status_changed: 'Status alterado',
  archived: 'Pedido arquivado',
  unarchived: 'Pedido desarquivado',
  venda_created: 'Venda registrada',
  estorno_created: 'Estorno registrado',
  payment_created: 'Pagamento registrado',
  historical_payment_recorded: 'Pagamento histórico registrado',
  stock_consumed: 'Estoque baixado',
  stock_manual_exit_registered: 'Saída manual de estoque',
  final_product_stock_adjusted: 'Estoque final ajustado',
  final_product_stock_inactivated: 'Produto final inativado',
};

export function getAuditActionLabel(action: string): string {
  return ACTION_LABELS[action] || 'Evento registrado';
}

function metadataText(metadata: AuditMetadataRecord, key: string) {
  const value = metadata[key];
  return typeof value === 'string' ? value : null;
}

function metadataNumber(metadata: AuditMetadataRecord, key: string) {
  const value = metadata[key];
  return typeof value === 'number' ? value : null;
}

export function formatAuditLogDetail(
  action: string,
  metadata: AuditMetadataRecord | null | undefined,
  formatCurrency: (value: number) => string,
  formatDate: (date: string) => string,
) {
  if (!metadata) return null;

  switch (action) {
    case 'status_changed':
      return `de ${getPedidoStatusLabel(metadataText(metadata, 'from') || '')} para ${getPedidoStatusLabel(metadataText(metadata, 'to') || '')}`;
    case 'archived': {
      const reason = metadataText(metadata, 'reason');
      return reason ? `Motivo: ${reason}` : null;
    }
    case 'payment_created':
    case 'historical_payment_recorded': {
      const valor = metadataNumber(metadata, 'delta');
      const dataPagamento = metadataText(metadata, 'data_pagamento');
      const partes = [
        valor !== null ? formatCurrency(valor) : null,
        dataPagamento ? formatDate(dataPagamento) : null,
      ].filter(Boolean);

      return partes.length > 0 ? partes.join(' • ') : null;
    }
    case 'venda_created':
    case 'estorno_created': {
      const valor = metadataNumber(metadata, 'valor');
      return valor !== null ? formatCurrency(valor) : null;
    }
    case 'stock_manual_exit_registered': {
      const quantidade = metadataNumber(metadata, 'quantidade');
      const unidade = metadataText(metadata, 'unidade');
      const motivo = metadataText(metadata, 'motivo');
      const partes = [
        quantidade !== null && unidade ? `${quantidade.toLocaleString('pt-BR')} ${unidade}` : null,
        motivo ? `Motivo: ${motivo}` : null,
      ].filter(Boolean);

      return partes.length > 0 ? partes.join(' • ') : null;
    }
    default:
      return null;
  }
}
