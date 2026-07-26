import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { getProdutoCatalogoVariacoesAtivas, summarizeProdutoCatalogo } from '@/domain/produtos';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export type ProdutoCatalogoVariacao = Tables<'produto_variacoes'>;
export type ProdutoCatalogo = Tables<'produtos'> & {
  variacoes: ProdutoCatalogoVariacao[];
};
export interface ProdutoComVariacaoInput {
  categoria_codigo: string;
  nome: string;
  modelo_producao: string;
  validade_dias: number | null;
  prazo_minimo_dias: number | null;
  necessita_refrigeracao: boolean;
  variacao_nome: string;
  variacao_tamanho: string | null;
  variacao_cobertura: string | null;
  variacao_preco_venda: number;
  variacao_custo_calculado: number;
  variacao_sob_encomenda: boolean;
  variacao_pronta_entrega: boolean;
}

interface CreateProductWithVariationRpc {
  (
    fn: 'create_product_with_variation',
    params: {
      p_categoria_codigo: string;
      p_nome: string;
      p_modelo_producao: string;
      p_validade_dias: number | null;
      p_prazo_minimo_dias: number | null;
      p_necessita_refrigeracao: boolean;
      p_variacao_nome: string;
      p_variacao_tamanho: string | null;
      p_variacao_cobertura: string | null;
      p_variacao_preco_venda: number;
      p_variacao_custo_calculado: number;
      p_variacao_sob_encomenda: boolean;
      p_variacao_pronta_entrega: boolean;
    },
  ): Promise<{
    data: string | null;
    error: Error | null;
  }>;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Erro inesperado';
}

function sortProdutoCatalogo(a: ProdutoCatalogo, b: ProdutoCatalogo) {
  const ordemDiff = a.ordem - b.ordem;
  if (ordemDiff !== 0) return ordemDiff;
  return a.nome.localeCompare(b.nome, 'pt-BR');
}

function sortProdutoVariacao(a: ProdutoCatalogoVariacao, b: ProdutoCatalogoVariacao) {
  const pesoA = a.peso_aproximado_g ?? Number.MAX_SAFE_INTEGER;
  const pesoB = b.peso_aproximado_g ?? Number.MAX_SAFE_INTEGER;
  if (pesoA !== pesoB) return pesoA - pesoB;
  return a.nome.localeCompare(b.nome, 'pt-BR');
}

export function useProdutosCatalogo() {
  const [produtos, setProdutos] = useState<ProdutoCatalogo[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchProdutosCatalogo = useCallback(async () => {
    if (!user) {
      setProdutos([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data: produtosData, error: produtosError } = await supabase
        .from('produtos')
        .select('*')
        .eq('ativo', true)
        .order('ordem', { ascending: true })
        .order('nome', { ascending: true });

      if (produtosError) throw produtosError;

      const produtosBase = (produtosData ?? []) as Tables<'produtos'>[];
      const produtoIds = produtosBase.map((produto) => produto.id);

      const { data: variacoesData, error: variacoesError } = produtoIds.length > 0
        ? await supabase
          .from('produto_variacoes')
          .select('*')
          .in('produto_id', produtoIds)
          .eq('ativo', true)
          .order('nome', { ascending: true })
        : { data: [], error: null };

      if (variacoesError) throw variacoesError;

      const variacoesPorProduto = new Map<string, ProdutoCatalogoVariacao[]>();
      for (const variacao of (variacoesData ?? []) as ProdutoCatalogoVariacao[]) {
        const variacoes = variacoesPorProduto.get(variacao.produto_id) ?? [];
        variacoes.push(variacao);
        variacoesPorProduto.set(variacao.produto_id, variacoes);
      }

      const catalogo = produtosBase
        .map((produto) => ({
          ...produto,
          variacoes: (variacoesPorProduto.get(produto.id) ?? []).sort(sortProdutoVariacao),
        }))
        .sort(sortProdutoCatalogo);

      setProdutos(catalogo);
    } catch (error: unknown) {
      toast({
        title: 'Erro ao carregar catálogo de produtos',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchProdutosCatalogo();
  }, [fetchProdutosCatalogo]);

  const addProdutoComVariacao = async (input: ProdutoComVariacaoInput) => {
    if (!user) return undefined;

    try {
      const createProductRpc = supabase.rpc.bind(supabase) as unknown as CreateProductWithVariationRpc;
      const { data: produtoId, error } = await createProductRpc('create_product_with_variation', {
        p_categoria_codigo: input.categoria_codigo,
        p_nome: input.nome,
        p_modelo_producao: input.modelo_producao,
        p_validade_dias: input.validade_dias,
        p_prazo_minimo_dias: input.prazo_minimo_dias,
        p_necessita_refrigeracao: input.necessita_refrigeracao,
        p_variacao_nome: input.variacao_nome,
        p_variacao_tamanho: input.variacao_tamanho,
        p_variacao_cobertura: input.variacao_cobertura,
        p_variacao_preco_venda: input.variacao_preco_venda,
        p_variacao_custo_calculado: input.variacao_custo_calculado,
        p_variacao_sob_encomenda: input.variacao_sob_encomenda,
        p_variacao_pronta_entrega: input.variacao_pronta_entrega,
      });

      if (error) throw error;

      await fetchProdutosCatalogo();
      toast({ title: 'Produto adicionado!' });
      return produtoId;
    } catch (error: unknown) {
      toast({
        title: 'Erro ao adicionar produto',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
      return undefined;
    }
  };

  const deleteProduto = async (id: string) => {
    try {
      const { error } = await supabase
        .from('produtos')
        .update({ ativo: false })
        .eq('id', id);

      if (error) throw error;
      setProdutos((current) => current.filter((produto) => produto.id !== id));
      toast({ title: 'Produto inativado!' });
    } catch (error: unknown) {
      toast({
        title: 'Erro ao inativar produto',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const resumo = useMemo(() => summarizeProdutoCatalogo(produtos), [produtos]);
  const variacoesAtivas = useMemo(
    () => produtos.flatMap((produto) => getProdutoCatalogoVariacoesAtivas(produto.variacoes)),
    [produtos],
  );

  return {
    produtos,
    variacoesAtivas,
    resumo,
    loading,
    addProdutoComVariacao,
    deleteProduto,
    refetch: fetchProdutosCatalogo,
  };
}
