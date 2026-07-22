import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface Fornecedor {
  id: string;
  nome: string;
  documento: string | null;
  telefone: string | null;
  email: string | null;
  observacoes: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

type FornecedorInsert = TablesInsert<'fornecedores'>;
type FornecedorUpdate = TablesUpdate<'fornecedores'>;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Erro inesperado';
}

export function useFornecedores() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchFornecedores = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('fornecedores')
        .select('*')
        .order('ativo', { ascending: false })
        .order('nome', { ascending: true });

      if (error) throw error;
      setFornecedores((data || []) as Fornecedor[]);
    } catch (error: unknown) {
      toast({
        title: 'Erro ao carregar fornecedores',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchFornecedores();
  }, [fetchFornecedores]);

  const addFornecedor = async (fornecedor: Omit<Fornecedor, 'id' | 'created_at' | 'updated_at'>) => {
    if (!user) return undefined;

    try {
      const insertData: FornecedorInsert = {
        nome: fornecedor.nome,
        documento: fornecedor.documento,
        telefone: fornecedor.telefone,
        email: fornecedor.email,
        observacoes: fornecedor.observacoes,
        ativo: fornecedor.ativo,
        user_id: user.id,
      };

      const { data, error } = await supabase
        .from('fornecedores')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      setFornecedores((current) => [...current, data as Fornecedor].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
      toast({ title: 'Fornecedor cadastrado com sucesso!' });
      return data as Fornecedor;
    } catch (error: unknown) {
      toast({
        title: 'Erro ao cadastrar fornecedor',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
      return undefined;
    }
  };

  const updateFornecedor = async (id: string, updates: Partial<Omit<Fornecedor, 'id'>>) => {
    try {
      const updateData: FornecedorUpdate = {};
      if (updates.nome !== undefined) updateData.nome = updates.nome;
      if (updates.documento !== undefined) updateData.documento = updates.documento;
      if (updates.telefone !== undefined) updateData.telefone = updates.telefone;
      if (updates.email !== undefined) updateData.email = updates.email;
      if (updates.observacoes !== undefined) updateData.observacoes = updates.observacoes;
      if (updates.ativo !== undefined) updateData.ativo = updates.ativo;

      const { data, error } = await supabase
        .from('fornecedores')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      setFornecedores((current) => current
        .map((fornecedor) => fornecedor.id === id ? data as Fornecedor : fornecedor)
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
      toast({ title: 'Fornecedor atualizado!' });
    } catch (error: unknown) {
      toast({
        title: 'Erro ao atualizar fornecedor',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const deleteFornecedor = async (id: string) => {
    try {
      const { error } = await supabase
        .from('fornecedores')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setFornecedores((current) => current.filter((fornecedor) => fornecedor.id !== id));
      toast({ title: 'Fornecedor removido!' });
    } catch (error: unknown) {
      toast({
        title: 'Erro ao remover fornecedor',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  return { fornecedores, loading, addFornecedor, updateFornecedor, deleteFornecedor, refetch: fetchFornecedores };
}
