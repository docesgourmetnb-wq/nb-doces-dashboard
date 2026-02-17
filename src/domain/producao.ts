export const PRODUCAO_STATUSES = ['planejado', 'em-andamento', 'concluido'] as const;
export type ProducaoStatus = (typeof PRODUCAO_STATUSES)[number];

const STATUS_CONFIG: Record<ProducaoStatus, { label: string; badgeClass: string }> = {
  'planejado':     { label: 'Planejado',     badgeClass: 'bg-muted text-muted-foreground border border-border' },
  'em-andamento':  { label: 'Em Andamento',  badgeClass: 'bg-info/15 text-info border border-info/25' },
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
