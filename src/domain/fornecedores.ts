export interface FornecedorPurchaseRow {
  fornecedor_id: string | null;
  valor: number;
  data: string | null;
}

export interface FornecedorPurchaseSummary {
  totalCompras: number;
  quantidadeCompras: number;
  ultimaCompra: string | null;
}

export interface FornecedorPurchaseHistoryRow extends FornecedorPurchaseRow {
  id: string;
  fornecedor_nome: string;
  descricao: string;
  categoria: string;
  quantidade: number | null;
  unidade: string | null;
  quantidade_embalagens: number | null;
  conteudo_por_embalagem: number | null;
  origem: 'estoque' | 'avulsa';
  origem_pagamento: string;
  created_at: string;
}

export interface FornecedorPurchaseHistoryGroup {
  id: string;
  fornecedor_id: string;
  fornecedor_nome: string;
  data: string | null;
  total: number;
  quantidadeLancamentos: number;
  itens: FornecedorPurchaseHistoryRow[];
}

export function summarizeFornecedorPurchases(rows: FornecedorPurchaseRow[]) {
  return rows.reduce<Record<string, FornecedorPurchaseSummary>>((acc, row) => {
    if (!row.fornecedor_id) return acc;

    const current = acc[row.fornecedor_id] ?? {
      totalCompras: 0,
      quantidadeCompras: 0,
      ultimaCompra: null,
    };

    const latestDate = row.data && (!current.ultimaCompra || row.data > current.ultimaCompra)
      ? row.data
      : current.ultimaCompra;

    acc[row.fornecedor_id] = {
      totalCompras: current.totalCompras + row.valor,
      quantidadeCompras: current.quantidadeCompras + 1,
      ultimaCompra: latestDate,
    };

    return acc;
  }, {});
}

export function groupFornecedorPurchaseHistory(rows: FornecedorPurchaseHistoryRow[]) {
  const grouped = rows.reduce<Record<string, FornecedorPurchaseHistoryGroup>>((acc, row) => {
    if (!row.fornecedor_id) return acc;

    const dataKey = row.data ?? 'sem-data';
    const key = `${row.fornecedor_id}:${dataKey}`;
    const current = acc[key] ?? {
      id: key,
      fornecedor_id: row.fornecedor_id,
      fornecedor_nome: row.fornecedor_nome,
      data: row.data,
      total: 0,
      quantidadeLancamentos: 0,
      itens: [],
    };

    acc[key] = {
      ...current,
      total: current.total + row.valor,
      quantidadeLancamentos: current.quantidadeLancamentos + 1,
      itens: [...current.itens, row],
    };

    return acc;
  }, {});

  return Object.values(grouped).sort((a, b) => {
    const dataCompare = (b.data ?? '').localeCompare(a.data ?? '');
    if (dataCompare !== 0) return dataCompare;
    return a.fornecedor_nome.localeCompare(b.fornecedor_nome, 'pt-BR');
  });
}
