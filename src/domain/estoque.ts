export type InsumoStockStatus = 'unset' | 'critical' | 'low' | 'ok';

export function getInsumoStockStatus(quantidadeAtual: number, quantidadeMinima: number) {
  if (!Number.isFinite(quantidadeMinima) || quantidadeMinima <= 0) {
    return {
      status: 'unset' as InsumoStockStatus,
      progressValue: 0,
      needsAttention: false,
    };
  }

  const ratio = quantidadeAtual / quantidadeMinima;
  const progressValue = Math.max(0, Math.min(ratio * 100, 100));

  if (ratio < 0.5) {
    return {
      status: 'critical' as InsumoStockStatus,
      progressValue,
      needsAttention: true,
    };
  }

  if (ratio <= 1) {
    return {
      status: 'low' as InsumoStockStatus,
      progressValue,
      needsAttention: true,
    };
  }

  return {
    status: 'ok' as InsumoStockStatus,
    progressValue,
    needsAttention: false,
  };
}

export function calculateInsumoEntry(
  quantidadeAtual: number,
  quantidadeEntrada: number,
  valorTotalEntrada: number,
) {
  if (!Number.isFinite(quantidadeEntrada) || quantidadeEntrada <= 0) {
    throw new Error('Quantidade de entrada inválida');
  }

  if (!Number.isFinite(valorTotalEntrada) || valorTotalEntrada < 0) {
    throw new Error('Valor total inválido');
  }

  return {
    quantidadeAtual: quantidadeAtual + quantidadeEntrada,
    precoUnitario: valorTotalEntrada > 0 ? valorTotalEntrada / quantidadeEntrada : 0,
  };
}
