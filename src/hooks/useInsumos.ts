import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface Insumo {
  id: string;
  nome: string;
  unidade: string;
  quantidade_atual: number;
  quantidade_minima: number;
  consumo_medio: number;
  preco_unitario: number;
  ultima_compra?: string | null;
}

type InsumoInsert = TablesInsert<'insumos'>;

interface RegisterInsumoEntryRpc {
  (
    fn: 'register_insumo_entry',
    params: {
      p_insumo_id: string;
      p_quantidade: number;
      p_valor_total: number;
      p_data_compra: string;
      p_fornecedor_id: string | null;
    },
  ): Promise<{
    data: Partial<Insumo> | null;
    error: Error | null;
  }>;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Erro inesperado';
}

export function useInsumos() {
  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchInsumos = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('insumos')
        .select('*')
        .not('unidade', 'in', '("SYS_MASSA","SYS_PROD")')
        .order('nome');

      if (error) throw error;
      setInsumos((data || []) as Insumo[]);
    } catch (error: unknown) {
      toast({
        title: 'Erro ao carregar estoque',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchInsumos();
  }, [fetchInsumos]);

  const addInsumo = async (insumo: Omit<Insumo, 'id'>) => {
    if (!user) return undefined;
    
    try {
      const insertData: InsumoInsert = {
        nome: insumo.nome,
        unidade: insumo.unidade,
        quantidade_atual: insumo.quantidade_atual,
        quantidade_minima: insumo.quantidade_minima,
        consumo_medio: insumo.consumo_medio,
        preco_unitario: insumo.preco_unitario,
        user_id: user.id,
      };
      if (insumo.ultima_compra !== undefined) {
        insertData.ultima_compra = insumo.ultima_compra;
      }

      const { data, error } = await supabase
        .from('insumos')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      const newInsumo = data as Insumo;
      setInsumos([...insumos, newInsumo]);
      toast({ title: 'Insumo adicionado!' });
      return newInsumo;
    } catch (error: unknown) {
      toast({
        title: 'Erro ao adicionar insumo',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
      return undefined;
    }
  };

  const updateInsumo = async (id: string, updates: Partial<Insumo>) => {
    try {
      const { data, error } = await supabase
        .from('insumos')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      const updatedInsumo = data as Insumo;
      setInsumos(insumos.map(i => i.id === id ? updatedInsumo : i));
      toast({ title: 'Insumo atualizado!' });
      return updatedInsumo;
    } catch (error: unknown) {
      toast({
        title: 'Erro ao atualizar insumo',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
      return undefined;
    }
  };

  const registerInsumoEntry = async (
    id: string,
    quantidade: number,
    valorTotal: number,
    dataCompra: string,
    fornecedorId: string | null = null,
  ) => {
    try {
      const registerEntryRpc = supabase.rpc.bind(supabase) as unknown as RegisterInsumoEntryRpc;
      const { data, error } = await registerEntryRpc('register_insumo_entry', {
        p_insumo_id: id,
        p_quantidade: quantidade,
        p_valor_total: valorTotal,
        p_data_compra: dataCompra,
        p_fornecedor_id: fornecedorId,
      });

      if (error) throw error;
      const updatedInsumo = data as Insumo;
      setInsumos(insumos.map(i => i.id === id ? updatedInsumo : i));
      toast({ title: 'Entrada de insumo registrada!' });
      return updatedInsumo;
    } catch (error: unknown) {
      toast({
        title: 'Erro ao registrar entrada de insumo',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
      return undefined;
    }
  };

  const deleteInsumo = async (id: string) => {
    try {
      const { error } = await supabase
        .from('insumos')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setInsumos(insumos.filter(i => i.id !== id));
      toast({ title: 'Insumo removido!' });
    } catch (error: unknown) {
      toast({
        title: 'Erro ao remover insumo',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  return { insumos, loading, addInsumo, updateInsumo, registerInsumoEntry, deleteInsumo, refetch: fetchInsumos };
}
