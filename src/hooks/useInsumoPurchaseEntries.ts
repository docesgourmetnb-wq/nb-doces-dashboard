import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface InsumoPurchaseEntry {
  id: string;
  user_id: string;
  insumo_id: string;
  fornecedor_id: string | null;
  quantidade: number;
  unidade: string;
  valor_total: number;
  preco_unitario: number;
  data_compra: string;
  transacao_referencia: string | null;
  created_at: string;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Erro inesperado';
}

export function useInsumoPurchaseEntries() {
  const [entries, setEntries] = useState<InsumoPurchaseEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchEntries = useCallback(async () => {
    if (!user) {
      setEntries([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('insumo_purchase_entries')
        .select('*')
        .order('data_compra', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setEntries((data || []) as InsumoPurchaseEntry[]);
    } catch (error: unknown) {
      toast({
        title: 'Erro ao carregar compras de insumos',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast, user]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  return { entries, loading, refetch: fetchEntries };
}
