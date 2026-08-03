import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  groupFornecedorPurchaseHistory,
  type FornecedorPurchaseHistoryGroup,
  type FornecedorPurchaseHistoryRow,
} from '@/domain/fornecedores';

export interface AddFornecedorPurchaseEntryInput {
  fornecedorId: string;
  descricao: string;
  categoria: string;
  valorTotal: number;
  dataCompra: string | null;
  origemPagamento: 'caixa' | 'fora_caixa';
  observacoes: string | null;
}

type FornecedorPurchaseEntryInsert = TablesInsert<'fornecedor_purchase_entries'>;
type TransacaoInsert = TablesInsert<'transacoes'>;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Erro inesperado';
}

export function useFornecedorPurchases() {
  const [historyGroups, setHistoryGroups] = useState<FornecedorPurchaseHistoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchHistory = useCallback(async () => {
    if (!user) {
      setHistoryGroups([]);
      setLoading(false);
      return;
    }

    try {
      const [{ data: stockEntries, error: stockError }, { data: looseEntries, error: looseError }] = await Promise.all([
        supabase
          .from('insumo_purchase_entries')
          .select('id, fornecedor_id, valor_total, data_compra, origem_pagamento, created_at, insumos(nome), fornecedores(nome)')
          .not('fornecedor_id', 'is', null)
          .gt('valor_total', 0)
          .order('data_compra', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(80),
        supabase
          .from('fornecedor_purchase_entries')
          .select('id, fornecedor_id, descricao, categoria, valor_total, data_compra, origem_pagamento, created_at, fornecedores(nome)')
          .gt('valor_total', 0)
          .order('data_compra', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false })
          .limit(80),
      ]);

      if (stockError) throw stockError;
      if (looseError) throw looseError;

      const stockRows: FornecedorPurchaseHistoryRow[] = (stockEntries || []).map((entry) => ({
        id: `estoque:${entry.id}`,
        fornecedor_id: entry.fornecedor_id,
        fornecedor_nome: entry.fornecedores?.nome ?? 'Fornecedor',
        descricao: entry.insumos?.nome ?? 'Entrada de estoque',
        categoria: 'Estoque',
        valor: Number(entry.valor_total) || 0,
        data: entry.data_compra,
        origem: 'estoque',
        origem_pagamento: entry.origem_pagamento,
        created_at: entry.created_at,
      }));

      const looseRows: FornecedorPurchaseHistoryRow[] = (looseEntries || []).map((entry) => ({
        id: `avulsa:${entry.id}`,
        fornecedor_id: entry.fornecedor_id,
        fornecedor_nome: entry.fornecedores?.nome ?? 'Fornecedor',
        descricao: entry.descricao,
        categoria: entry.categoria,
        valor: Number(entry.valor_total) || 0,
        data: entry.data_compra,
        origem: 'avulsa',
        origem_pagamento: entry.origem_pagamento,
        created_at: entry.created_at,
      }));

      setHistoryGroups(groupFornecedorPurchaseHistory([...stockRows, ...looseRows]));
    } catch (error: unknown) {
      toast({
        title: 'Erro ao carregar histórico de compras',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const addLoosePurchase = async (input: AddFornecedorPurchaseEntryInput) => {
    if (!user) return undefined;

    try {
      let transacaoReferencia: string | null = null;

      if (input.origemPagamento === 'caixa' && input.dataCompra) {
        transacaoReferencia = `fornecedor-avulsa:${crypto.randomUUID()}`;
        const transacao: TransacaoInsert = {
          user_id: user.id,
          tipo: 'saida',
          categoria: input.categoria === 'Utensilios' ? 'Equipamentos' : 'Outras saídas',
          descricao: `Compra avulsa: ${input.descricao}`,
          valor: input.valorTotal,
          data: input.dataCompra,
          referencia: transacaoReferencia,
          fornecedor_id: input.fornecedorId,
        };

        const { error: transacaoError } = await supabase
          .from('transacoes')
          .insert(transacao);

        if (transacaoError) throw transacaoError;
      }

      const insertData: FornecedorPurchaseEntryInsert = {
        user_id: user.id,
        fornecedor_id: input.fornecedorId,
        descricao: input.descricao,
        categoria: input.categoria,
        valor_total: input.valorTotal,
        data_compra: input.dataCompra,
        origem_pagamento: input.origemPagamento,
        transacao_referencia: transacaoReferencia,
        observacoes: input.observacoes,
      };

      const { data, error } = await supabase
        .from('fornecedor_purchase_entries')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      await fetchHistory();
      toast({ title: 'Compra avulsa registrada!' });
      return data;
    } catch (error: unknown) {
      toast({
        title: 'Erro ao registrar compra avulsa',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
      return undefined;
    }
  };

  return { historyGroups, loading, addLoosePurchase, refetch: fetchHistory };
}
