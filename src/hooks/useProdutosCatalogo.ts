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
    refetch: fetchProdutosCatalogo,
  };
}
