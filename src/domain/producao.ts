export const PRODUCAO_STATUSES = ['planejado', 'em-andamento', 'concluido'] as const;
export type ProducaoStatus = (typeof PRODUCAO_STATUSES)[number];

const STATUS_CONFIG: Record<ProducaoStatus, { label: string; badgeClass: string }> = {
  'planejado':     { label: 'Planejado',     badgeClass: 'bg-muted text-muted-foreground border border-border' },
  'em-andamento':  { label: 'Em produção',   badgeClass: 'bg-info/15 text-info border border-info/25' },
  'concluido':     { label: 'Concluído',     badgeClass: 'bg-success/15 text-success border border-success/25' },
};

export function getProducaoStatusLabel(status: string): string {
  return STATUS_CONFIG[status as ProducaoStatus]?.label ?? status;
}

export function getProducaoStatusBadgeClass(status: string): string {
  return STATUS_CONFIG[status as ProducaoStatus]?.badgeClass ?? '';
}

export function isProducaoConcluida(status: string): boolean {
  return status === 'concluido';
}

function formatQuantity(value: string): string {
  const quantity = Number(value);
  if (!Number.isFinite(quantity)) return value;

  return quantity.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

export function getProducaoErrorMessage(message: string): string {
  const insufficientStockMatch = message.match(
    /^Saldo insuficiente para insumo (.+): saldo ([\d.]+), necessário ([\d.]+)$/i,
  );

  if (!insufficientStockMatch) return message;

  const [, itemName, available, required] = insufficientStockMatch;
  if (!itemName || !available || !required) return message;

  return `Estoque insuficiente: ${itemName}. Disponível: ${formatQuantity(available)}. Necessário: ${formatQuantity(required)}.`;
}
