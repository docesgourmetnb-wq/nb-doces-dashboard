export const PEDIDO_STATUSES = ['pendente', 'em-producao', 'pronto', 'entregue', 'cancelado'] as const;
export type PedidoStatus = (typeof PEDIDO_STATUSES)[number];

const STATUS_CONFIG: Record<PedidoStatus, { label: string; badgeClass: string }> = {
  'pendente':     { label: 'Pendente',     badgeClass: 'bg-muted text-muted-foreground' },
  'em-producao':  { label: 'Em Produção',  badgeClass: 'bg-info/20 text-info' },
  'pronto':       { label: 'Pronto',       badgeClass: 'bg-warning/20 text-warning' },
  'entregue':     { label: 'Entregue',     badgeClass: 'bg-success/20 text-success' },
  'cancelado':    { label: 'Cancelado',    badgeClass: 'bg-destructive/20 text-destructive' },
};

export function getPedidoStatusLabel(status: string): string {
  return STATUS_CONFIG[status as PedidoStatus]?.label ?? status;
}

export function getPedidoStatusBadgeClass(status: string): string {
  return STATUS_CONFIG[status as PedidoStatus]?.badgeClass ?? '';
}

/** Terminal states: no more workflow transitions expected */
export function isPedidoTerminal(status: string): boolean {
  return status === 'entregue' || status === 'cancelado';
}

/** Only 'entregue' generates revenue */
export function shouldGenerateRevenue(status: string): boolean {
  return status === 'entregue';
}

export const PAGAMENTO_LABELS: Record<string, string> = {
  'pix': 'PIX',
  'cartao': 'Cartão',
  'dinheiro': 'Dinheiro',
  'transferencia': 'Transferência',
};
