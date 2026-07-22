export interface FornecedorPurchaseRow {
  fornecedor_id: string | null;
  valor: number;
  data: string;
}

export interface FornecedorPurchaseSummary {
  totalCompras: number;
  quantidadeCompras: number;
  ultimaCompra: string | null;
}

export function summarizeFornecedorPurchases(rows: FornecedorPurchaseRow[]) {
  return rows.reduce<Record<string, FornecedorPurchaseSummary>>((acc, row) => {
    if (!row.fornecedor_id) return acc;

    const current = acc[row.fornecedor_id] ?? {
      totalCompras: 0,
      quantidadeCompras: 0,
      ultimaCompra: null,
    };

    acc[row.fornecedor_id] = {
      totalCompras: current.totalCompras + row.valor,
      quantidadeCompras: current.quantidadeCompras + 1,
      ultimaCompra: !current.ultimaCompra || row.data > current.ultimaCompra
        ? row.data
        : current.ultimaCompra,
    };

    return acc;
  }, {});
}
