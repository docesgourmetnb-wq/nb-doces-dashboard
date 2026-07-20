import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Recipiente } from './useRecipientes';
import { getMassaValidadeInfo } from '@/domain/massasCongeladas';

type MassaCongeladaRow = Tables<'massas_congeladas'>;
type RecipienteRow = Tables<'recipientes'>;
type MassaCongeladaWithRecipiente = MassaCongeladaRow & {
  recipiente?: RecipienteRow | null;
};

function getTodayKey() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

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

function withPesoMassa(massa: MassaCongeladaWithRecipiente): MassaComPesoCalculado {
  const { recipiente, ...massaData } = massa;

  return {
    ...massaData,
    status: massa.status as MassaCongelada['status'],
    ...(recipiente ? { recipiente: recipiente as Recipiente } : {}),
    peso_massa: massa.peso_total - (recipiente?.peso_vazio || 0),
  };
}

export function useMassasCongeladas() {
  const [massas, setMassas] = useState<MassaComPesoCalculado[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchMassas = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('massas_congeladas')
        .select(`
          *,
          recipiente:recipientes(*)
        `)
        .order('data_producao', { ascending: true });

      if (error) {
        if (import.meta.env.DEV) console.error('Error fetching massas:', error);
        toast({
          title: 'Erro ao carregar massas',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        // Calculate peso_massa for each item
        const massasComPeso = (data || []).map(withPesoMassa);
        setMassas(massasComPeso);
      }
    } finally {
      setLoading(false);
    }
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
      if (import.meta.env.DEV) console.error('Error adding massa:', error);
      toast({
        title: 'Erro ao adicionar massa',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    }

    const massaComPeso = withPesoMassa(data);

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
      if (import.meta.env.DEV) console.error('Error updating massa:', error);
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
      if (import.meta.env.DEV) console.error('Error deleting massa:', error);
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

  // Computed values
  const estoqueAtual = massas.filter(m => m.status !== 'consumido');
  const totalPesoEstoque = estoqueAtual.reduce((sum, m) => sum + m.peso_massa, 0);
  const todayKey = getTodayKey();
  const massasProximasValidade = estoqueAtual.filter(m => getMassaValidadeInfo(m.validade, todayKey).status === 'proxima');
  const massasVencidas = estoqueAtual.filter(m => getMassaValidadeInfo(m.validade, todayKey).status === 'vencida');

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
    massasVencidas,
  };
}
