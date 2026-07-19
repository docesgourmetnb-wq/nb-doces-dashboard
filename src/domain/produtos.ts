export function getProdutoNomeBase(nome: string) {
  return nome
    .replace(/\s+\d+(?:[,.]\d+)?\s*g$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getProdutoTamanho(nome: string) {
  return nome.match(/(\d+(?:[,.]\d+)?)\s*g$/i)?.[0].replace(/\s+/g, '') ?? null;
}

export interface ProdutoResumoInput {
  nome: string;
  margem_lucro?: number | null;
}

export interface ProdutoResumo {
  total: number;
  total25g: number;
  total30g: number;
  semTamanho: number;
  margemMedia: number;
}

export function summarizeProdutos(produtos: ProdutoResumoInput[]): ProdutoResumo {
  const total = produtos.length;
  const total25g = produtos.filter((produto) => getProdutoTamanho(produto.nome) === '25g').length;
  const total30g = produtos.filter((produto) => getProdutoTamanho(produto.nome) === '30g').length;
  const semTamanho = total - total25g - total30g;
  const margens = produtos
    .map((produto) => produto.margem_lucro)
    .filter((margem): margem is number => Number.isFinite(margem));
  const margemMedia = margens.length > 0
    ? margens.reduce((totalMargem, margem) => totalMargem + margem, 0) / margens.length
    : 0;

  return {
    total,
    total25g,
    total30g,
    semTamanho,
    margemMedia,
  };
}
