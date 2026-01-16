import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Recipiente } from './useRecipientes';

export interface MassaCongelada {
  id: string;
  recipiente_id: string;
  tipo_massa: string;
  peso_total: number;
  data_producao: string;
  data_congelamento: string;
  validade: string;
  foto_url: string | null;
  status: 'congelado' | 'em_uso' | 'consumido';
  created_at: string;
  updated_at: string;
  // Joined data
  recipiente?: Recipiente;
}

export interface MassaComPesoCalculado extends MassaCongelada {
  peso_massa: number; // Calculated: peso_total - recipiente.peso_vazio
}

export function useMassasCongeladas() {
  const [massas, setMassas] = useState<MassaComPesoCalculado[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchMassas = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('massas_congeladas')
      .select(`
        *,
        recipiente:recipientes(*)
      `)
      .order('data_producao', { ascending: true });

    if (error) {
      console.error('Error fetching massas:', error);
      toast({
        title: 'Erro ao carregar massas',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      // Calculate peso_massa for each item
      const massasComPeso = (data || []).map((m: any) => ({
        ...m,
        peso_massa: m.peso_total - (m.recipiente?.peso_vazio || 0),
      }));
      setMassas(massasComPeso);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchMassas();
  }, [fetchMassas]);

  const addMassa = async (massa: {
    recipiente_id: string;
    tipo_massa: string;
    peso_total: number;
    data_producao: string;
    data_congelamento: string;
    validade: string;
    foto_url?: string | null;
  }) => {
    if (!user) return null;

    const { data, error } = await supabase
      .from('massas_congeladas')
      .insert([{ ...massa, user_id: user.id, status: 'congelado' }])
      .select(`
        *,
        recipiente:recipientes(*)
      `)
      .single();

    if (error) {
      console.error('Error adding massa:', error);
      toast({
        title: 'Erro ao adicionar massa',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    }

    const massaComPeso = {
      ...data,
      peso_massa: data.peso_total - (data.recipiente?.peso_vazio || 0),
    } as MassaComPesoCalculado;

    setMassas(prev => [...prev, massaComPeso]);
    toast({
      title: 'Massa congelada registrada',
      description: `${massaComPeso.peso_massa}g de massa foram adicionados ao estoque.`,
    });
    return massaComPeso;
  };

  const updateMassa = async (id: string, updates: Partial<MassaCongelada>) => {
    const { error } = await supabase
      .from('massas_congeladas')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('Error updating massa:', error);
      toast({
        title: 'Erro ao atualizar massa',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }

    // Refetch to get updated calculated values
    await fetchMassas();
    toast({
      title: 'Massa atualizada',
      description: 'As alterações foram salvas.',
    });
    return true;
  };

  const deleteMassa = async (id: string) => {
    const { error } = await supabase
      .from('massas_congeladas')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting massa:', error);
      toast({
        title: 'Erro ao excluir massa',
        description: error.message,
        variant: 'destructive',
      });
      return false;
    }

    setMassas(prev => prev.filter(m => m.id !== id));
    toast({
      title: 'Massa excluída',
      description: 'O registro foi removido.',
    });
    return true;
  };

  const uploadFoto = async (file: File) => {
    if (!user) return null;

    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}/massa-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('massas-fotos')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Error uploading photo:', uploadError);
      toast({
        title: 'Erro ao enviar foto',
        description: uploadError.message,
        variant: 'destructive',
      });
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('massas-fotos')
      .getPublicUrl(filePath);

    return publicUrl;
  };

  // Computed values
  const estoqueAtual = massas.filter(m => m.status !== 'consumido');
  const totalPesoEstoque = estoqueAtual.reduce((sum, m) => sum + m.peso_massa, 0);
  const massasProximasValidade = estoqueAtual.filter(m => {
    const validade = new Date(m.validade);
    const hoje = new Date();
    const diasRestantes = Math.ceil((validade.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    return diasRestantes <= 7 && diasRestantes >= 0;
  });

  return {
    massas,
    loading,
    addMassa,
    updateMassa,
    deleteMassa,
    uploadFoto,
    refetch: fetchMassas,
    // Computed
    estoqueAtual,
    totalPesoEstoque,
    massasProximasValidade,
  };
}
