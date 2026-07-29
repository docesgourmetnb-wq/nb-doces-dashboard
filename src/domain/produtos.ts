export function getProdutoNomeBase(nome: string) {
  return nome
    .replace(/\s+\d+(?:[,.]\d+)?\s*g$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getProdutoTamanho(nome: string) {
  return nome.match(/(\d+(?:[,.]\d+)?)\s*g$/i)?.[0].replace(/\s+/g, '') ?? null;
}

export const BRIGADEIRO_TAMANHOS_COMERCIAIS = ['25g', '30g'] as const;
export type BrigadeiroTamanhoComercial = typeof BRIGADEIRO_TAMANHOS_COMERCIAIS[number];
export type BrigadeiroTamanhoFilter = 'todos' | BrigadeiroTamanhoComercial;

export const BRIGADEIRO_TAMANHO_FILTERS: Array<{ value: BrigadeiroTamanhoFilter; label: string }> = [
  { value: 'todos', label: 'Todos' },
  ...BRIGADEIRO_TAMANHOS_COMERCIAIS.map((tamanho) => ({ value: tamanho, label: tamanho })),
];

export function isBrigadeiroTamanhoGramas(tamanho: number) {
  return BRIGADEIRO_TAMANHOS_COMERCIAIS.includes(`${tamanho}g` as BrigadeiroTamanhoComercial);
}

export interface ProdutoCategoriaInput {
  nome: string;
  categoria?: string | null;
  tamanho_g?: number | null;
}

export const PRODUTO_CATEGORIAS = ['brigadeiro', 'bolo'] as const;
export type ProdutoCategoria = (typeof PRODUTO_CATEGORIAS)[number];

export const PRODUTO_CATEGORIA_LABELS: Record<ProdutoCategoria, string> = {
  brigadeiro: 'Brigadeiro',
  bolo: 'Bolo',
};

export interface ProdutoVariacaoCatalogoInput {
  ativo?: boolean | null;
}

export interface ProdutoCatalogoInput {
  categoria_codigo: string;
  ativo?: boolean | null;
  variacoes?: ProdutoVariacaoCatalogoInput[] | null;
}

export function isProdutoBrigadeiro(produto: ProdutoCategoriaInput) {
  return (produto.categoria ?? 'brigadeiro') === 'brigadeiro';
}

export function isProdutoCategoria(categoria: string | null | undefined): categoria is ProdutoCategoria {
  return PRODUTO_CATEGORIAS.includes(categoria as ProdutoCategoria);
}

export function getProdutoCategoriaLabel(categoria: string | null | undefined) {
  return isProdutoCategoria(categoria) ? PRODUTO_CATEGORIA_LABELS[categoria] : 'Produto';
}

export function filterProdutoCatalogoByCategoria<T extends ProdutoCatalogoInput>(
  produtos: T[],
  categoria: ProdutoCategoria | 'todos',
) {
  if (categoria === 'todos') return produtos;
  return produtos.filter((produto) => produto.categoria_codigo === categoria);
}

export function getProdutoCatalogoVariacoesAtivas<T extends ProdutoVariacaoCatalogoInput>(
  variacoes: T[] | null | undefined,
) {
  return (variacoes ?? []).filter((variacao) => variacao.ativo !== false);
}

export function summarizeProdutoCatalogo(produtos: ProdutoCatalogoInput[]) {
  const produtosAtivos = produtos.filter((produto) => produto.ativo !== false);
  const produtosBrigadeiros = produtosAtivos.filter((produto) => produto.categoria_codigo === 'brigadeiro');
  const produtosBolos = produtosAtivos.filter((produto) => produto.categoria_codigo === 'bolo');
  const totalVariacoesAtivas = produtosAtivos.reduce(
    (total, produto) => total + getProdutoCatalogoVariacoesAtivas(produto.variacoes).length,
    0,
  );
  const totalVariacoesBrigadeiros = produtosBrigadeiros.reduce(
    (total, produto) => total + getProdutoCatalogoVariacoesAtivas(produto.variacoes).length,
    0,
  );
  const totalVariacoesBolos = produtosBolos.reduce(
    (total, produto) => total + getProdutoCatalogoVariacoesAtivas(produto.variacoes).length,
    0,
  );

  return {
    totalProdutos: produtosAtivos.length,
    totalBrigadeiros: produtosBrigadeiros.length,
    totalBolos: produtosBolos.length,
    totalVariacoesAtivas,
    totalVariacoesBrigadeiros,
    totalVariacoesBolos,
  };
}

export function getProdutoNomeComercial(produto: ProdutoCategoriaInput) {
  if (!isProdutoBrigadeiro(produto)) return produto.nome.trim();
  return getProdutoNomeBase(produto.nome);
}

export function filterProdutosBrigadeiro<T extends ProdutoCategoriaInput>(produtos: T[]) {
  return produtos.filter(isProdutoBrigadeiro);
}

export function getProdutoTamanhoComercial(produto: ProdutoCategoriaInput) {
  if (!isProdutoBrigadeiro(produto)) return null;
  if (Number.isFinite(produto.tamanho_g)) {
    return `${Number(produto.tamanho_g).toLocaleString('pt-BR')}g`;
  }
  return getProdutoTamanho(produto.nome);
}

export function inferProdutoTamanhoGramas(nome: string) {
  const tamanho = getProdutoTamanho(nome);
  if (!tamanho) return null;
  return Number(tamanho.replace(/g$/i, '').replace(',', '.'));
}

export function matchesBrigadeiroTamanhoFilter(
  produto: ProdutoCategoriaInput,
  filter: BrigadeiroTamanhoFilter,
) {
  if (!isProdutoBrigadeiro(produto)) return false;
  return filter === 'todos' || getProdutoTamanhoComercial(produto) === filter;
}

export interface ProdutoResumoInput {
  nome: string;
  categoria?: string | null;
  tamanho_g?: number | null;
  margem_lucro?: number | null;
}

export interface ProdutoResumo {
  total: number;
  total25g: number;
  total30g: number;
  semTamanho: number;
  margemMedia: number;
  saboresSemPar: ProdutoSemPar[];
}

export function summarizeProdutos(produtos: ProdutoResumoInput[]): ProdutoResumo {
  const total = produtos.length;
  const total25g = produtos.filter((produto) => getProdutoTamanhoComercial(produto) === '25g').length;
  const total30g = produtos.filter((produto) => getProdutoTamanhoComercial(produto) === '30g').length;
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
    saboresSemPar: findProdutosSemParDeTamanho(produtos),
  };
}

export interface EstoqueProdutoFinalResumoInput extends ProdutoCategoriaInput {
  quantidade_un: number;
}

export function summarizeEstoqueProdutosFinais(produtos: EstoqueProdutoFinalResumoInput[]) {
  return produtos.reduce(
    (summary, produto) => {
      const quantidade = Number.isFinite(produto.quantidade_un) ? produto.quantidade_un : 0;
      const tamanho = getProdutoTamanhoComercial(produto);

      return {
        totalUnidades: summary.totalUnidades + quantidade,
        total25g: summary.total25g + (tamanho === '25g' ? quantidade : 0),
        total30g: summary.total30g + (tamanho === '30g' ? quantidade : 0),
        semTamanho: summary.semTamanho + (!tamanho ? quantidade : 0),
      };
    },
    {
      totalUnidades: 0,
      total25g: 0,
      total30g: 0,
      semTamanho: 0,
    },
  );
}

export interface ProdutoSemPar {
  nomeBase: string;
  faltando: Array<'25g' | '30g'>;
}

export function findProdutosSemParDeTamanho(produtos: ProdutoResumoInput[]): ProdutoSemPar[] {
  const tamanhosPorSabor = new Map<string, Set<string>>();

  for (const produto of produtos) {
    const nomeBase = getProdutoNomeComercial(produto);
    const tamanho = getProdutoTamanhoComercial(produto);
    if (!nomeBase || !tamanho) continue;

    if (!tamanhosPorSabor.has(nomeBase)) {
      tamanhosPorSabor.set(nomeBase, new Set());
    }
    tamanhosPorSabor.get(nomeBase)?.add(tamanho);
  }

  return Array.from(tamanhosPorSabor.entries())
    .map(([nomeBase, tamanhos]) => {
      const faltando: Array<'25g' | '30g'> = [];
      if (!tamanhos.has('25g')) faltando.push('25g');
      if (!tamanhos.has('30g')) faltando.push('30g');
      return { nomeBase, faltando };
    })
    .filter((produto) => produto.faltando.length > 0)
    .sort((a, b) => a.nomeBase.localeCompare(b.nomeBase, 'pt-BR'));
}
