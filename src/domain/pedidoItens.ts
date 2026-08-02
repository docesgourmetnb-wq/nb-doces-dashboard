import { getProdutoNomeComercial, getProdutoTamanhoComercial } from './produtos.ts';

export interface PedidoItemDisplayInput {
  brigadeiro_id?: string | null;
  brigadeiro_nome?: string | null;
  brigadeiro_categoria?: string | null;
  brigadeiro_tamanho_g?: number | null;
  produto_categoria?: string | null;
  produto_nome?: string | null;
  produto_variacao_nome?: string | null;
  produto_variacao_tamanho?: string | null;
  produto_variacao_cobertura?: string | null;
}

export interface PedidoItemProdutoLookup {
  nome: string;
  categoria?: string | null;
  tamanho_g?: number | null;
}

export interface PedidoItemDisplayInfo {
  nomeBase: string;
  detalhe: string | null;
}

function uniqueNonEmpty(values: Array<string | null | undefined>) {
  const seen = new Set<string>();
  return values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .filter((value) => {
      const key = value.toLocaleLowerCase('pt-BR');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function getPedidoItemDisplayInfo(
  item: PedidoItemDisplayInput,
  produtoLookup?: PedidoItemProdutoLookup | null,
): PedidoItemDisplayInfo {
  const categoria = item.produto_categoria ?? item.brigadeiro_categoria ?? produtoLookup?.categoria ?? null;

  if (categoria === 'bolo') {
    const nomeBase = item.produto_nome?.trim()
      || produtoLookup?.nome.trim()
      || item.brigadeiro_nome?.trim()
      || 'Bolo';
    const detalhes = uniqueNonEmpty([
      item.produto_variacao_nome,
      item.produto_variacao_tamanho,
      item.produto_variacao_cobertura,
    ]).filter((detalhe) => detalhe.toLocaleLowerCase('pt-BR') !== nomeBase.toLocaleLowerCase('pt-BR'));

    return {
      nomeBase,
      detalhe: detalhes.join(' • ') || null,
    };
  }

  const produto = produtoLookup ?? {
    nome: item.brigadeiro_nome?.trim() || 'Produto',
    categoria,
    tamanho_g: item.brigadeiro_tamanho_g ?? null,
  };
  const nomeBase = getProdutoNomeComercial(produto) || item.brigadeiro_nome?.trim() || 'Produto';
  const detalhe = getProdutoTamanhoComercial(produto);

  return { nomeBase, detalhe };
}

export function getPedidoItemDisplayLabel(info: PedidoItemDisplayInfo) {
  return info.detalhe ? `${info.nomeBase} ${info.detalhe}` : info.nomeBase;
}
