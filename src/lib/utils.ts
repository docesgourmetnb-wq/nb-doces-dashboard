import { clsx, type ClassValue } from "clsx";
import { format } from "date-fns";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseLocalDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);

  if (!year || !month || !day) {
    return new Date(date);
  }

  return new Date(year, month - 1, day);
}

export function formatLocalDate(date: string, pattern: string, options?: Parameters<typeof format>[2]) {
  return format(parseLocalDate(date), pattern, options);
}

export function formatCurrencyBRL(value: number) {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}
