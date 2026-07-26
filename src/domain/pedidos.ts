export const PEDIDO_STATUSES = ['orcamento', 'confirmado', 'em-producao', 'pronto', 'entregue', 'cancelado'] as const;
export type PedidoStatus = (typeof PEDIDO_STATUSES)[number];

export const PEDIDO_FINANCEIRO_STATUSES = ['nao_pago', 'parcial', 'pago'] as const;
export type PedidoFinanceiroStatus = (typeof PEDIDO_FINANCEIRO_STATUSES)[number];

export const ENTREGA_TIPOS = ['retirada', 'entrega'] as const;
export type EntregaTipo = (typeof ENTREGA_TIPOS)[number];

export const CANAIS_VENDA = ['whatsapp', 'instagram'] as const;
export type CanalVenda = (typeof CANAIS_VENDA)[number];

const STATUS_CONFIG: Record<PedidoStatus, { label: string; badgeClass: string }> = {
  'orcamento':    { label: 'Orçamento',    badgeClass: 'bg-muted text-muted-foreground border border-border' },
  'confirmado':   { label: 'Confirmado',   badgeClass: 'bg-primary/15 text-primary border border-primary/25' },
  'em-producao':  { label: 'Em Produção',  badgeClass: 'bg-info/15 text-info border border-info/25' },
  'pronto':       { label: 'Pronto',       badgeClass: 'bg-warning/15 text-warning border border-warning/25' },
  'entregue':     { label: 'Entregue',     badgeClass: 'bg-success/15 text-success border border-success/25' },
  'cancelado':    { label: 'Cancelado',    badgeClass: 'bg-destructive/15 text-destructive border border-destructive/25' },
};

const FINANCEIRO_STATUS_CONFIG: Record<PedidoFinanceiroStatus, { label: string; badgeClass: string }> = {
  'nao_pago': { label: 'Não pago', badgeClass: 'bg-muted text-muted-foreground border border-border' },
  'parcial':  { label: 'Parcial',  badgeClass: 'bg-warning/15 text-warning border border-warning/25' },
  'pago':     { label: 'Pago',     badgeClass: 'bg-success/15 text-success border border-success/25' },
};

export function getPedidoStatusLabel(status: string): string {
  return STATUS_CONFIG[status as PedidoStatus]?.label ?? status;
}

export function getPedidoStatusBadgeClass(status: string): string {
  return STATUS_CONFIG[status as PedidoStatus]?.badgeClass ?? '';
}

export function getPedidoFinanceiroStatusLabel(status: string): string {
  return FINANCEIRO_STATUS_CONFIG[status as PedidoFinanceiroStatus]?.label ?? status;
}

export function getPedidoFinanceiroStatusBadgeClass(status: string): string {
  return FINANCEIRO_STATUS_CONFIG[status as PedidoFinanceiroStatus]?.badgeClass ?? '';
}

/** Terminal states: no more workflow transitions expected */
export function isPedidoTerminal(status: string): boolean {
  return status === 'entregue' || status === 'cancelado';
}

/** Revenue is tied to payment status, not operational delivery status. */
export function shouldGenerateRevenue(status: string): boolean {
  return status === 'pago';
}

export function derivePedidoFinanceiroStatus(valorTotal: number, valorPago: number): PedidoFinanceiroStatus {
  if (valorPago <= 0) return 'nao_pago';
  if (valorPago >= valorTotal) return 'pago';
  return 'parcial';
}

export function calculateNextPedidoValorPago(valorPagoAtual: number, saldoRestante: number, valorRecebido: number) {
  if (!Number.isFinite(valorRecebido) || valorRecebido <= 0) return null;
  if (valorRecebido > saldoRestante) return null;
  return valorPagoAtual + valorRecebido;
}

export function getPedidoStatusUpdateErrorMessage(message: string) {
  if (message.includes('Estoque pronto insuficiente')) {
    return `${message}. Produza ou registre entrada no estoque de Produtos Finais antes de avançar o status.`;
  }

  if (message.includes('saldo pendente') || message.includes('Saldo pendente')) {
    return 'Este pedido ainda possui saldo pendente. Registre o pagamento antes de marcar como entregue.';
  }

  return message || 'Erro inesperado';
}

export function sanitizePedidoSearchTerm(search: string) {
  return search
    .trim()
    .replace(/[(),]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildPedidoSearchFilter(search: string, clienteIds: string[] = []) {
  const searchTerm = sanitizePedidoSearchTerm(search);
  if (!searchTerm) return null;

  const filters = [`cliente.ilike.%${searchTerm}%`];
  if (clienteIds.length > 0) {
    filters.push(`cliente_id.in.(${clienteIds.join(',')})`);
  }

  return filters.join(',');
}

export const PAGAMENTO_LABELS: Record<string, string> = {
  'pix': 'PIX',
  'cartao': 'Cartão',
  'dinheiro': 'Dinheiro',
  'transferencia': 'Transferência',
};

export const ENTREGA_LABELS: Record<EntregaTipo, string> = {
  retirada: 'Retirada',
  entrega: 'Entrega',
};

export const CANAL_VENDA_LABELS: Record<CanalVenda, string> = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
};
