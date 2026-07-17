import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface Cliente {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  created_at: string;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Erro inesperado';
}

export function useClientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchClientes = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('nome', { ascending: true });

      if (error) throw error;
      setClientes(data || []);
    } catch (error: unknown) {
      toast({
        title: 'Erro ao carregar clientes',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  const addCliente = async (cliente: Omit<Cliente, 'id' | 'created_at'>) => {
    if (!user) return undefined;
    
    try {
      const { data, error } = await supabase
        .from('clientes')
        .insert({
          nome: cliente.nome,
          email: cliente.email,
          telefone: cliente.telefone,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      setClientes([...clientes, data]);
      toast({ title: 'Cliente cadastrado com sucesso!' });
      return data;
    } catch (error: unknown) {
      toast({
        title: 'Erro ao cadastrar cliente',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
      return undefined;
    }
  };

  const updateCliente = async (id: string, updates: Partial<Omit<Cliente, 'id'>>) => {
    try {
      const { error } = await supabase
        .from('clientes')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      setClientes(clientes.map(c => c.id === id ? { ...c, ...updates } : c));
      toast({ title: 'Cliente atualizado!' });
    } catch (error: unknown) {
      toast({
        title: 'Erro ao atualizar cliente',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const deleteCliente = async (id: string) => {
    try {
      const { error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setClientes(clientes.filter(c => c.id !== id));
      toast({ title: 'Cliente removido!' });
    } catch (error: unknown) {
      toast({
        title: 'Erro ao remover cliente',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  return { clientes, loading, addCliente, updateCliente, deleteCliente, refetch: fetchClientes };
}
