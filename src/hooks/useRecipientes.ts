import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';

export interface Recipiente {
  id: string;
  codigo: string;
  tipo_recipiente: string;
  peso_vazio: number;
  capacidade_aproximada: number | null;
  foto_url: string | null;
  observacoes: string | null;
  status: 'disponivel' | 'em_uso' | 'inativo';
  created_at: string;
  updated_at: string;
}

export function useRecipientes() {
  const [recipientes, setRecipientes] = useState<Recipiente[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchRecipientes = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    const { data, error } = await supabase
      .from('recipientes')
      .select('*')
      .order('codigo', { ascending: true });

    if (error) {
      if (import.meta.env.DEV) console.error('Error fetching recipientes:', error);
      toast({
        title: 'Erro ao carregar recipientes',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setRecipientes(data as Recipiente[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchRecipientes();
  }, [fetchRecipientes]);

  const addRecipiente = async (recipiente: Omit<Recipiente, 'id' | 'created_at' | 'updated_at'>) => {
    if (!user) return;

    const { data, error } = await supabase
      .from('recipientes')
      .insert([{ ...recipiente, user_id: user.id }])
      .select()
      .single();

    if (error) {
      if (import.meta.env.DEV) console.error('Error adding recipiente:', error);
      toast({
        title: 'Erro ao adicionar recipiente',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    }

    setRecipientes(prev => [...prev, data as Recipiente]);
    toast({
      title: 'Recipiente adicionado',
      description: `${recipiente.codigo} foi cadastrado com sucesso.`,
    });
    return data;
  };

  const updateRecipiente = async (id: string, updates: Partial<Recipiente>) => {
    const { error } = await supabase
      .from('recipientes')
      .update(updates)
      .eq('id', id);

    if (error) {
      if (import.meta.env.DEV) console.error('Error updating recipiente:', error);
      toast({
        title: 'Erro ao atualizar recipiente',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }

    setRecipientes(prev => 
      prev.map(r => r.id === id ? { ...r, ...updates } : r)
    );
    toast({
      title: 'Recipiente atualizado',
      description: 'As alterações foram salvas.',
    });
    return true;
  };

  const deleteRecipiente = async (id: string) => {
    const { error } = await supabase
      .from('recipientes')
      .delete()
      .eq('id', id);

    if (error) {
      if (import.meta.env.DEV) console.error('Error deleting recipiente:', error);
      toast({
        title: 'Erro ao excluir recipiente',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }

    setRecipientes(prev => prev.filter(r => r.id !== id));
    toast({
      title: 'Recipiente excluído',
      description: 'O recipiente foi removido.',
    });
    return true;
  };

  const uploadFoto = async (file: File, codigo: string) => {
    if (!user) return null;

    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/${codigo}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('massas-fotos')
      .upload(filePath, file);

    if (uploadError) {
      if (import.meta.env.DEV) console.error('Error uploading photo:', uploadError);
      toast({
        title: 'Erro ao enviar foto',
        description: uploadError.message,
        variant: 'destructive',
      });
      return null;
    }

    const { data, error: signedUrlError } = await supabase.storage
      .from('massas-fotos')
      .createSignedUrl(filePath, 86400); // 24 hours expiry

    if (signedUrlError) {
      if (import.meta.env.DEV) console.error('Error creating signed URL:', signedUrlError);
      toast({
        title: 'Erro ao gerar URL da foto',
        description: signedUrlError.message,
        variant: 'destructive',
      });
      return null;
    }

    return data.signedUrl;
  };

  return {
    recipientes,
    loading,
    addRecipiente,
    updateRecipiente,
    deleteRecipiente,
    uploadFoto,
    refetch: fetchRecipientes,
  };
}
