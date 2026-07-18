import { parseLocalDate } from '../lib/utils.ts';

export type MassaValidadeStatus = 'vencida' | 'proxima' | 'ok';

export interface MassaValidadeInfo {
  diasRestantes: number;
  status: MassaValidadeStatus;
}

export function getMassaValidadeInfo(validade: string, today: string, warningDays = 7): MassaValidadeInfo {
  const validadeDate = parseLocalDate(validade);
  const todayDate = parseLocalDate(today);
  const diffMs = validadeDate.getTime() - todayDate.getTime();
  const diasRestantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diasRestantes < 0) {
    return { diasRestantes, status: 'vencida' };
  }

  if (diasRestantes <= warningDays) {
    return { diasRestantes, status: 'proxima' };
  }

  return { diasRestantes, status: 'ok' };
}
