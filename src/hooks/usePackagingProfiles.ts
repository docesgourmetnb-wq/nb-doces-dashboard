import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export type PackagingProfileBase = Tables<'packaging_profiles'>;
export type PackagingProfileItemBase = Tables<'packaging_profile_items'>;

export type PackagingProfileItem = PackagingProfileItemBase & {
  insumos?: Pick<Tables<'insumos'>, 'id' | 'nome' | 'unidade' | 'tipo_estoque'> | null;
};

export type PackagingProfile = PackagingProfileBase & {
  items: PackagingProfileItem[];
};

type PackagingProfileInsert = TablesInsert<'packaging_profiles'>;
type PackagingProfileItemInsert = TablesInsert<'packaging_profile_items'>;

interface SavePackagingProfileRpc {
  (
    fn: 'save_packaging_profile',
    params: {
      p_profile_id: string | null;
      p_nome: string;
      p_observacoes: string | null;
    },
  ): Promise<{ data: PackagingProfileBase | null; error: Error | null }>;
}

interface ArchivePackagingProfileRpc {
  (
    fn: 'archive_packaging_profile',
    params: { p_profile_id: string },
  ): Promise<{ data: PackagingProfileBase | null; error: Error | null }>;
}

interface AddPackagingProfileItemRpc {
  (
    fn: 'add_packaging_profile_item',
    params: {
      p_profile_id: string;
      p_insumo_id: string;
      p_quantidade_por_pedido: number;
      p_observacoes: string | null;
    },
  ): Promise<{ data: PackagingProfileItemBase | null; error: Error | null }>;
}

interface UpdatePackagingProfileItemRpc {
  (
    fn: 'update_packaging_profile_item',
    params: {
      p_item_id: string;
      p_quantidade_por_pedido: number;
      p_observacoes: string | null;
    },
  ): Promise<{ data: PackagingProfileItemBase | null; error: Error | null }>;
}

interface RemovePackagingProfileItemRpc {
  (
    fn: 'remove_packaging_profile_item',
    params: { p_item_id: string },
  ): Promise<{ data: PackagingProfileItemBase | null; error: Error | null }>;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Erro inesperado';
}

export function usePackagingProfiles() {
  const [profiles, setProfiles] = useState<PackagingProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchProfiles = useCallback(async () => {
    if (!user) {
      setProfiles([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('packaging_profiles')
        .select('*, packaging_profile_items(*, insumos(id,nome,unidade,tipo_estoque))')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;

      const formattedProfiles = ((data ?? []) as Array<PackagingProfileBase & {
        packaging_profile_items?: PackagingProfileItem[] | null;
      }>).map((profile) => ({
        ...profile,
        items: [...(profile.packaging_profile_items ?? [])].sort((a, b) => {
          const nameA = a.insumos?.nome ?? '';
          const nameB = b.insumos?.nome ?? '';
          return nameA.localeCompare(nameB, 'pt-BR');
        }),
      }));

      setProfiles(formattedProfiles);
    } catch (error: unknown) {
      toast({
        title: 'Erro ao carregar modelos de embalagem',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast, user]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const addProfile = async (input: Pick<PackagingProfileInsert, 'nome' | 'observacoes'>) => {
    if (!user) return undefined;

    try {
      const saveProfileRpc = supabase.rpc.bind(supabase) as unknown as SavePackagingProfileRpc;
      const { data, error } = await saveProfileRpc('save_packaging_profile', {
        p_profile_id: null,
        p_nome: input.nome.trim(),
        p_observacoes: input.observacoes?.trim() || null,
      });

      if (error) throw error;
      await fetchProfiles();
      toast({ title: 'Modelo de embalagem criado!' });
      return data as PackagingProfileBase;
    } catch (error: unknown) {
      toast({
        title: 'Erro ao criar modelo de embalagem',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
      return undefined;
    }
  };

  const updateProfile = async (id: string, input: { nome: string; observacoes?: string | null }) => {
    try {
      const saveProfileRpc = supabase.rpc.bind(supabase) as unknown as SavePackagingProfileRpc;
      const { data, error } = await saveProfileRpc('save_packaging_profile', {
        p_profile_id: id,
        p_nome: input.nome.trim(),
        p_observacoes: input.observacoes?.trim() || null,
      });

      if (error) throw error;
      await fetchProfiles();
      toast({ title: 'Modelo de embalagem atualizado!' });
      return data as PackagingProfileBase;
    } catch (error: unknown) {
      toast({
        title: 'Erro ao atualizar modelo de embalagem',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
      return undefined;
    }
  };

  const deleteProfile = async (id: string) => {
    try {
      const archiveProfileRpc = supabase.rpc.bind(supabase) as unknown as ArchivePackagingProfileRpc;
      const { error } = await archiveProfileRpc('archive_packaging_profile', {
        p_profile_id: id,
      });

      if (error) throw error;
      await fetchProfiles();
      toast({ title: 'Modelo de embalagem arquivado!' });
    } catch (error: unknown) {
      toast({
        title: 'Erro ao arquivar modelo de embalagem',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  const addProfileItem = async (input: Omit<PackagingProfileItemInsert, 'id' | 'created_at' | 'updated_at' | 'user_id'>) => {
    if (!user) return undefined;

    try {
      const addItemRpc = supabase.rpc.bind(supabase) as unknown as AddPackagingProfileItemRpc;
      const { data, error } = await addItemRpc('add_packaging_profile_item', {
        p_profile_id: input.profile_id,
        p_insumo_id: input.insumo_id,
        p_quantidade_por_pedido: input.quantidade_por_pedido,
        p_observacoes: input.observacoes?.trim() || null,
      });

      if (error) throw error;
      await fetchProfiles();
      toast({ title: 'Item adicionado ao modelo!' });
      return data as PackagingProfileItemBase;
    } catch (error: unknown) {
      toast({
        title: 'Erro ao adicionar item ao modelo',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
      return undefined;
    }
  };

  const updateProfileItem = async (id: string, input: { quantidade_por_pedido: number; observacoes?: string | null }) => {
    try {
      const updateItemRpc = supabase.rpc.bind(supabase) as unknown as UpdatePackagingProfileItemRpc;
      const { data, error } = await updateItemRpc('update_packaging_profile_item', {
        p_item_id: id,
        p_quantidade_por_pedido: input.quantidade_por_pedido,
        p_observacoes: input.observacoes?.trim() || null,
      });

      if (error) throw error;
      await fetchProfiles();
      toast({ title: 'Item do modelo atualizado!' });
      return data as PackagingProfileItemBase;
    } catch (error: unknown) {
      toast({
        title: 'Erro ao atualizar item do modelo',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
      return undefined;
    }
  };

  const deleteProfileItem = async (id: string) => {
    try {
      const removeItemRpc = supabase.rpc.bind(supabase) as unknown as RemovePackagingProfileItemRpc;
      const { error } = await removeItemRpc('remove_packaging_profile_item', {
        p_item_id: id,
      });

      if (error) throw error;
      await fetchProfiles();
      toast({ title: 'Item removido do modelo!' });
    } catch (error: unknown) {
      toast({
        title: 'Erro ao remover item do modelo',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    }
  };

  return {
    profiles,
    loading,
    addProfile,
    updateProfile,
    deleteProfile,
    addProfileItem,
    updateProfileItem,
    deleteProfileItem,
    refetch: fetchProfiles,
  };
}
