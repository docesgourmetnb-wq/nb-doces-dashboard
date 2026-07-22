import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export type LaboratorioTipo = 'ideia' | 'teste' | 'feedback';
export type LaboratorioStatus = 'ideia' | 'em_teste' | 'aprovado' | 'descartado' | 'acao_gerada';
export type LaboratorioPrioridade = 'baixa' | 'media' | 'alta';
export type LaboratorioCanal = 'whatsapp' | 'instagram' | 'presencial' | 'outro';

export interface LaboratorioItem {
  id: string;
  user_id: string;
  tipo: LaboratorioTipo;
  titulo: string;
  descricao: string | null;
  status: LaboratorioStatus;
  prioridade: LaboratorioPrioridade;
  cliente: string | null;
  produto_relacionado: string | null;
  canal: LaboratorioCanal | null;
  data_registro: string;
  created_at: string;
  updated_at: string;
}

type LaboratorioInsert = TablesInsert<'laboratorio_items'>;
type LaboratorioUpdate = TablesUpdate<'laboratorio_items'>;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Erro inesperado';
}

export function useLaboratorioItems() {
  const [items, setItems] = useState<LaboratorioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchItems = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('laboratorio_items')
        .select('*')
        .order('data_registro', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setItems((data || []) as LaboratorioItem[]);
    } catch (error: unknown) {
      toast({
        title: 'Erro ao carregar laboratório',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const addItem = async (item: Omit<LaboratorioItem, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    if (!user) return undefined;

    try {
      const insertData: LaboratorioInsert = {
        user_id: user.id,
        tipo: item.tipo,
        titulo: item.titulo,
        descricao: item.descricao,
        status: item.status,
        prioridade: item.prioridade,
        cliente: item.cliente,
        produto_relacionado: item.produto_relacionado,
        canal: item.canal,
        data_registro: item.data_registro,
      };

      const { data, error } = await supabase
        .from('laboratorio_items')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      setItems((current) => [data as LaboratorioItem, ...current]);
      toast({ title: 'Registro salvo no laboratório!' });
      return data as LaboratorioItem;
    } catch (error: unknown) {
      toast({
        title: 'Erro ao salvar registro',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
      return undefined;
    }
  };

  const updateItem = async (id: string, updates: Partial<Omit<LaboratorioItem, 'id' | 'user_id' | 'created_at' | 'updated_at'>>) => {
    try {
      const updateData: LaboratorioUpdate = {};
      if (updates.tipo !== undefined) updateData.tipo = updates.tipo;
      if (updates.titulo !== undefined) updateData.titulo = updates.titulo;
      if (updates.descricao !== undefined) updateData.descricao = updates.descricao;
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.prioridade !== undefined) updateData.prioridade = updates.prioridade;
      if (updates.cliente !== undefined) updateData.cliente = updates.cliente;
      if (updates.produto_relacionado !== undefined) updateData.produto_relacionado = updates.produto_relacionado;
      if (updates.canal !== undefined) updateData.canal = updates.canal;
      if (updates.data_registro !== undefined) updateData.data_registro = updates.data_registro;

      const { data, error } = await supabase
        .from('laboratorio_items')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setItems((current) => current.map((item) => item.id === id ? data as LaboratorioItem : item));
      toast({ title: 'Registro atualizado!' });
      return data as LaboratorioItem;
    } catch (error: unknown) {
      toast({
        title: 'Erro ao atualizar registro',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
      return undefined;
    }
  };

  const deleteItem = async (id: string) => {
    try {
      const { error } = await supabase
        .from('laboratorio_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setItems((current) => current.filter((item) => item.id !== id));
      toast({ title: 'Registro removido!' });
    } catch (error: unknown) {
      toast({
        title: 'Erro ao remover registro',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  return { items, loading, addItem, updateItem, deleteItem, refetch: fetchItems };
}
