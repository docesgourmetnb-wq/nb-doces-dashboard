export type InsumoStockStatus = 'unset' | 'critical' | 'low' | 'ok';
export type InsumoEntryMode = 'embalagens' | 'quantidade';

export function getInsumoEntryModePadrao(unidade: string): InsumoEntryMode {
  return unidade === 'cm' ? 'quantidade' : 'embalagens';
}

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

export function calculateInsumoExit(quantidadeAtual: number, quantidadeSaida: number) {
  if (!Number.isFinite(quantidadeAtual) || quantidadeAtual < 0) {
    throw new Error('Saldo atual inválido');
  }

  if (!Number.isFinite(quantidadeSaida) || quantidadeSaida <= 0) {
    throw new Error('Quantidade de saída inválida');
  }

  if (quantidadeSaida > quantidadeAtual) {
    throw new Error('Saldo insuficiente');
  }

  return {
    quantidadeAtual: quantidadeAtual - quantidadeSaida,
  };
}

export function calculateInsumoPurchaseQuantity(quantidadeEmbalagens: number, conteudoPorEmbalagem: number) {
  if (!Number.isFinite(quantidadeEmbalagens) || quantidadeEmbalagens <= 0) {
    throw new Error('Quantidade de embalagens inválida');
  }

  if (!Number.isFinite(conteudoPorEmbalagem) || conteudoPorEmbalagem <= 0) {
    throw new Error('Conteúdo por embalagem inválido');
  }

  return quantidadeEmbalagens * conteudoPorEmbalagem;
}

export function calculateInsumoPackageEquivalent(quantidadeAtual: number, conteudoPorEmbalagem: number) {
  if (!Number.isFinite(quantidadeAtual) || quantidadeAtual < 0) {
    return null;
  }

  if (!Number.isFinite(conteudoPorEmbalagem) || conteudoPorEmbalagem <= 0) {
    return null;
  }

  return quantidadeAtual / conteudoPorEmbalagem;
}

export function formatInsumoPackageReference(
  quantidadeAtual: number,
  conteudoPorEmbalagem: number,
  unidade: string,
  options: { includeAvailableQuantity?: boolean } = {},
) {
  const equivalente = calculateInsumoPackageEquivalent(quantidadeAtual, conteudoPorEmbalagem);
  const { includeAvailableQuantity = true } = options;

  if (equivalente === null) return null;

  const quantidadeFormatada = quantidadeAtual.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
  const conteudoFormatado = conteudoPorEmbalagem.toLocaleString('pt-BR', { maximumFractionDigits: 3 });

  if (Number.isInteger(equivalente)) {
    const embalagemLabel = equivalente === 1 ? 'embalagem' : 'embalagens';
    return `${equivalente.toLocaleString('pt-BR')} ${embalagemLabel} de ${conteudoFormatado} ${unidade}`;
  }

  const percentual = (equivalente * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  if (!includeAvailableQuantity) {
    return `${percentual}% de uma embalagem de ${conteudoFormatado} ${unidade}`;
  }

  return `${quantidadeFormatada} ${unidade} disponíveis · ${percentual}% de uma embalagem de ${conteudoFormatado} ${unidade}`;
}

export function formatInsumoCurrentStockPackageReference(
  quantidadeAtual: number,
  conteudoPorEmbalagem: number,
  unidade: string,
) {
  const equivalente = calculateInsumoPackageEquivalent(quantidadeAtual, conteudoPorEmbalagem);

  if (equivalente === null || equivalente < 1) return null;

  const embalagensInteiras = Math.floor(equivalente);
  const restante = quantidadeAtual - embalagensInteiras * conteudoPorEmbalagem;
  const embalagemLabel = embalagensInteiras === 1 ? 'embalagem' : 'embalagens';
  const conteudoFormatado = conteudoPorEmbalagem.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
  const embalagensLabel = `${embalagensInteiras.toLocaleString('pt-BR')} ${embalagemLabel} de ${conteudoFormatado} ${unidade}`;

  if (Math.abs(restante) < 0.000001) {
    return embalagensLabel;
  }

  const restanteFormatado = restante.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
  return `${embalagensLabel} + ${restanteFormatado} ${unidade}`;
}

export interface InsumoStockValueInput {
  id: string;
  quantidadeAtual: number;
}

export interface InsumoPurchaseValueInput {
  insumoId: string;
  quantidade: number;
  valorTotal: number;
}

export function summarizeKnownInsumoStockValue(
  insumos: InsumoStockValueInput[],
  purchaseEntries: InsumoPurchaseValueInput[],
) {
  const knownPurchasesByInsumo = new Map<string, { quantidade: number; valorTotal: number }>();

  purchaseEntries.forEach((entry) => {
    if (
      !Number.isFinite(entry.quantidade)
      || entry.quantidade <= 0
      || !Number.isFinite(entry.valorTotal)
      || entry.valorTotal <= 0
    ) {
      return;
    }

    const current = knownPurchasesByInsumo.get(entry.insumoId) ?? { quantidade: 0, valorTotal: 0 };
    knownPurchasesByInsumo.set(entry.insumoId, {
      quantidade: current.quantidade + entry.quantidade,
      valorTotal: current.valorTotal + entry.valorTotal,
    });
  });

  return insumos.reduce(
    (summary, insumo) => {
      if (!Number.isFinite(insumo.quantidadeAtual) || insumo.quantidadeAtual <= 0) {
        return summary;
      }

      const knownPurchase = knownPurchasesByInsumo.get(insumo.id);

      if (!knownPurchase || knownPurchase.quantidade <= 0 || knownPurchase.valorTotal <= 0) {
        return {
          ...summary,
          insumosComSaldoSemCusto: summary.insumosComSaldoSemCusto + 1,
        };
      }

      const custoMedioConhecido = knownPurchase.valorTotal / knownPurchase.quantidade;
      const quantidadeComCustoConhecido = Math.min(insumo.quantidadeAtual, knownPurchase.quantidade);
      const hasSaldoSemCusto = insumo.quantidadeAtual > knownPurchase.quantidade;

      return {
        valorConhecido: summary.valorConhecido + (quantidadeComCustoConhecido * custoMedioConhecido),
        insumosComSaldoSemCusto: summary.insumosComSaldoSemCusto + (hasSaldoSemCusto ? 1 : 0),
      };
    },
    {
      valorConhecido: 0,
      insumosComSaldoSemCusto: 0,
    },
  );
}
