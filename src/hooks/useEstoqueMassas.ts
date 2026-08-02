import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

type InsumoRow = Tables<'insumos'>;

export interface EstoqueMassa {
  id: string;
  sabor: string;
  quantidade_g: number;
  user_id: string;
  created_at: string;
  updated_at: string;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Erro inesperado';
}

function toEstoqueMassa(insumo: InsumoRow): EstoqueMassa {
  return {
    id: insumo.id,
    sabor: insumo.nome.replace('[MASSA] ', ''),
    quantidade_g: insumo.quantidade_atual || 0,
    user_id: insumo.user_id,
    created_at: insumo.created_at,
    updated_at: insumo.updated_at,
  };
}

interface RegisterBaseMassStockRpc {
  (
    fn: 'register_base_mass_stock',
    params: {
      p_sabor: string;
      p_quantidade_inicial: number;
    },
  ): Promise<{
    data: InsumoRow | null;
    error: Error | null;
  }>;
}

interface AdjustBaseMassStockRpc {
  (
    fn: 'adjust_base_mass_stock',
    params: {
      p_insumo_id: string;
      p_quantidade_delta: number;
    },
  ): Promise<{
    data: InsumoRow | null;
    error: Error | null;
  }>;
}

interface InactivateBaseMassStockRpc {
  (
    fn: 'inactivate_base_mass_stock',
    params: {
      p_insumo_id: string;
    },
  ): Promise<{
    data: InsumoRow | null;
    error: Error | null;
  }>;
}

export function useEstoqueMassas() {
  const [massas, setMassas] = useState<EstoqueMassa[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchMassas = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      // Using insumos as a generic inventory table to bypass DB migration requirements
      const { data, error } = await supabase
        .from('insumos')
        .select('*')
        .eq('unidade', 'SYS_MASSA')
        .eq('ativo', true);

      if (error) throw error;
      
      const massasFormatadas = (data || [])
        .map(toEstoqueMassa)
        .sort((a, b) => a.sabor.localeCompare(b.sabor));

      setMassas(massasFormatadas);
    } catch (error: unknown) {
      if (import.meta.env.DEV) console.error('Error fetching massas:', error);
      toast({
        title: 'Erro ao carregar estoque de bases',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchMassas();
  }, [fetchMassas]);

  const addMassa = async (sabor: string, quantidade_g: number) => {
    if (!user) return null;

    try {
      const registerStockRpc = supabase.rpc.bind(supabase) as unknown as RegisterBaseMassStockRpc;
      const { data, error } = await registerStockRpc('register_base_mass_stock', {
        p_sabor: sabor,
        p_quantidade_inicial: quantidade_g,
      });

      if (error) throw error;
      if (!data) throw new Error('Massa base não retornada pelo banco');
      
      const novaMassa = toEstoqueMassa(data);

      setMassas(prev => {
        const exists = prev.some((massa) => massa.id === novaMassa.id);
        const newState = exists
          ? prev.map((massa) => massa.id === novaMassa.id ? novaMassa : massa)
          : [...prev, novaMassa];
        return newState.sort((a, b) => a.sabor.localeCompare(b.sabor));
      });
      toast({
        title: 'Massa adicionada',
        description: 'Sabor cadastrado no estoque.',
      });
      return novaMassa;
    } catch (error: unknown) {
      toast({
        title: 'Erro ao cadastrar sabor',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
      return null;
    }
  };

  const updateQuantidade = async (id: string, quantidadeDelta: number) => {
    const massa = massas.find(m => m.id === id);
    if (!massa) return false;

    const novaQuantidade = massa.quantidade_g + quantidadeDelta;
    if (novaQuantidade < 0) {
        toast({
            title: 'Operação inválida',
            description: 'A quantidade não pode ficar negativa.',
            variant: 'destructive',
          });
          return false;
    }

    try {
      const adjustStockRpc = supabase.rpc.bind(supabase) as unknown as AdjustBaseMassStockRpc;
      const { data, error } = await adjustStockRpc('adjust_base_mass_stock', {
        p_insumo_id: id,
        p_quantidade_delta: quantidadeDelta,
      });

      if (error) throw error;

      const quantidadeAtual = data?.quantidade_atual ?? novaQuantidade;
      setMassas(prev => prev.map(m => m.id === id ? { ...m, quantidade_g: quantidadeAtual } : m));
      toast({
        title: 'Estoque atualizado',
        description: `Saldo atualizado com sucesso.`,
      });
      return true;
    } catch (error: unknown) {
      toast({
        title: 'Erro ao atualizar saldo',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
      return false;
    }
  };

  const deleteMassa = async (id: string) => {
    try {
      const inactivateStockRpc = supabase.rpc.bind(supabase) as unknown as InactivateBaseMassStockRpc;
      const { error } = await inactivateStockRpc('inactivate_base_mass_stock', {
        p_insumo_id: id,
      });

      if (error) throw error;

      setMassas(prev => prev.filter(m => m.id !== id));
      toast({
        title: 'Massa inativada',
        description: 'Sabor removido da operação, com histórico preservado.',
      });
      return true;
    } catch (error: unknown) {
      toast({
        title: 'Erro ao excluir',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    massas,
    loading,
    addMassa,
    updateQuantidade,
    deleteMassa,
    refetch: fetchMassas,
  };
}
