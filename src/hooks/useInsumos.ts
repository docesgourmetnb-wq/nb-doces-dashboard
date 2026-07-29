import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { buildInsumoCadastroDefaults, type InsumoTipoEstoque } from '@/domain/insumos';

export interface Insumo {
  id: string;
  nome: string;
  unidade: string;
  ativo: boolean;
  quantidade_atual: number;
  quantidade_minima: number;
  consumo_medio: number;
  preco_unitario: number;
  tipo_estoque?: InsumoTipoEstoque | null;
  ultima_compra?: string | null;
}

type InsumoInsert = TablesInsert<'insumos'>;
export type InsumoCadastroInput = Pick<Insumo, 'nome' | 'unidade' | 'quantidade_minima'> & {
  tipo_estoque: InsumoTipoEstoque;
};
export type InsumoCadastroUpdate = Partial<InsumoCadastroInput>;

interface RegisterInsumoEntryRpc {
  (
    fn: 'register_insumo_entry',
    params: {
      p_insumo_id: string;
      p_quantidade: number;
      p_valor_total: number;
      p_data_compra: string | null;
      p_fornecedor_id: string | null;
      p_quantidade_embalagens: number | null;
      p_conteudo_por_embalagem: number | null;
    },
  ): Promise<{
    data: Partial<Insumo> | null;
    error: Error | null;
  }>;
}

interface RegisterInsumoManualExitRpc {
  (
    fn: 'register_insumo_manual_exit',
    params: {
      p_insumo_id: string;
      p_quantidade: number;
      p_motivo: string | null;
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
        .eq('ativo', true)
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

  const addInsumo = async (insumo: InsumoCadastroInput) => {
    if (!user) return undefined;
    
    try {
      const cadastroData = buildInsumoCadastroDefaults({
        nome: insumo.nome,
        unidade: insumo.unidade,
        quantidadeMinima: insumo.quantidade_minima,
        tipoEstoque: insumo.tipo_estoque,
      });
      const insertData: InsumoInsert = {
        ...cadastroData,
        ativo: true,
        user_id: user.id,
      };

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

  const updateInsumo = async (id: string, updates: InsumoCadastroUpdate) => {
    try {
      const cadastroUpdates: InsumoCadastroUpdate = {};
      if (updates.nome !== undefined) cadastroUpdates.nome = updates.nome.trim();
      if (updates.unidade !== undefined) cadastroUpdates.unidade = updates.unidade;
      if (updates.quantidade_minima !== undefined) cadastroUpdates.quantidade_minima = updates.quantidade_minima;
      if (updates.tipo_estoque !== undefined) cadastroUpdates.tipo_estoque = updates.tipo_estoque;

      const { data, error } = await supabase
        .from('insumos')
        .update(cadastroUpdates)
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
    dataCompra: string | null,
    fornecedorId: string | null = null,
    quantidadeEmbalagens: number | null = null,
    conteudoPorEmbalagem: number | null = null,
  ) => {
    try {
      const registerEntryRpc = supabase.rpc.bind(supabase) as unknown as RegisterInsumoEntryRpc;
      const { data, error } = await registerEntryRpc('register_insumo_entry', {
        p_insumo_id: id,
        p_quantidade: quantidade,
        p_valor_total: valorTotal,
        p_data_compra: dataCompra,
        p_fornecedor_id: fornecedorId,
        p_quantidade_embalagens: quantidadeEmbalagens,
        p_conteudo_por_embalagem: conteudoPorEmbalagem,
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

  const registerInsumoManualExit = async (
    id: string,
    quantidade: number,
    motivo: string | null = null,
  ) => {
    try {
      const registerExitRpc = supabase.rpc.bind(supabase) as unknown as RegisterInsumoManualExitRpc;
      const { data, error } = await registerExitRpc('register_insumo_manual_exit', {
        p_insumo_id: id,
        p_quantidade: quantidade,
        p_motivo: motivo,
      });

      if (error) throw error;
      const updatedInsumo = data as Insumo;
      setInsumos(insumos.map(i => i.id === id ? updatedInsumo : i));
      toast({ title: 'Saída de estoque registrada!' });
      return updatedInsumo;
    } catch (error: unknown) {
      toast({
        title: 'Erro ao registrar saída de estoque',
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
        .update({ ativo: false })
        .eq('id', id);

      if (error) throw error;
      setInsumos(insumos.filter(i => i.id !== id));
      toast({ title: 'Insumo inativado!' });
    } catch (error: unknown) {
      toast({
        title: 'Erro ao inativar insumo',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  return { insumos, loading, addInsumo, updateInsumo, registerInsumoEntry, registerInsumoManualExit, deleteInsumo, refetch: fetchInsumos };
}
