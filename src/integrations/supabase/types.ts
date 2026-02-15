export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      brigadeiros: {
        Row: {
          ativo: boolean
          created_at: string
          custo_unitario: number
          descricao: string | null
          id: string
          margem_lucro: number | null
          nome: string
          preco_venda: number
          tipo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          custo_unitario?: number
          descricao?: string | null
          id?: string
          margem_lucro?: number | null
          nome: string
          preco_venda?: number
          tipo?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          custo_unitario?: number
          descricao?: string | null
          id?: string
          margem_lucro?: number | null
          nome?: string
          preco_venda?: number
          tipo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nome: string
          telefone: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          nome: string
          telefone?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          telefone?: string | null
          user_id?: string
        }
        Relationships: []
      }
      insumos: {
        Row: {
          consumo_medio: number
          created_at: string
          id: string
          nome: string
          preco_unitario: number
          quantidade_atual: number
          quantidade_minima: number
          ultima_compra: string | null
          unidade: string
          updated_at: string
          user_id: string
        }
        Insert: {
          consumo_medio?: number
          created_at?: string
          id?: string
          nome: string
          preco_unitario?: number
          quantidade_atual?: number
          quantidade_minima?: number
          ultima_compra?: string | null
          unidade: string
          updated_at?: string
          user_id: string
        }
        Update: {
          consumo_medio?: number
          created_at?: string
          id?: string
          nome?: string
          preco_unitario?: number
          quantidade_atual?: number
          quantidade_minima?: number
          ultima_compra?: string | null
          unidade?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      itens_pedido: {
        Row: {
          brigadeiro_id: string | null
          brigadeiro_nome: string
          id: string
          pedido_id: string
          preco_unitario: number
          quantidade: number
        }
        Insert: {
          brigadeiro_id?: string | null
          brigadeiro_nome: string
          id?: string
          pedido_id: string
          preco_unitario?: number
          quantidade?: number
        }
        Update: {
          brigadeiro_id?: string | null
          brigadeiro_nome?: string
          id?: string
          pedido_id?: string
          preco_unitario?: number
          quantidade?: number
        }
        Relationships: [
          {
            foreignKeyName: "itens_pedido_brigadeiro_id_fkey"
            columns: ["brigadeiro_id"]
            isOneToOne: false
            referencedRelation: "brigadeiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_pedido_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      massas_congeladas: {
        Row: {
          created_at: string
          data_congelamento: string
          data_producao: string
          foto_url: string | null
          id: string
          peso_total: number
          recipiente_id: string
          status: string
          tipo_massa: string
          updated_at: string
          user_id: string
          validade: string
        }
        Insert: {
          created_at?: string
          data_congelamento?: string
          data_producao?: string
          foto_url?: string | null
          id?: string
          peso_total: number
          recipiente_id: string
          status?: string
          tipo_massa?: string
          updated_at?: string
          user_id: string
          validade: string
        }
        Update: {
          created_at?: string
          data_congelamento?: string
          data_producao?: string
          foto_url?: string | null
          id?: string
          peso_total?: number
          recipiente_id?: string
          status?: string
          tipo_massa?: string
          updated_at?: string
          user_id?: string
          validade?: string
        }
        Relationships: [
          {
            foreignKeyName: "massas_congeladas_recipiente_id_fkey"
            columns: ["recipiente_id"]
            isOneToOne: false
            referencedRelation: "recipientes"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          cliente: string
          cliente_id: string | null
          created_at: string
          data: string
          forma_pagamento: string
          id: string
          observacoes: string | null
          status: string
          tipo_pedido: string
          updated_at: string
          user_id: string
          valor_total: number
        }
        Insert: {
          cliente: string
          cliente_id?: string | null
          created_at?: string
          data?: string
          forma_pagamento?: string
          id?: string
          observacoes?: string | null
          status?: string
          tipo_pedido?: string
          updated_at?: string
          user_id: string
          valor_total?: number
        }
        Update: {
          cliente?: string
          cliente_id?: string | null
          created_at?: string
          data?: string
          forma_pagamento?: string
          id?: string
          observacoes?: string | null
          status?: string
          tipo_pedido?: string
          updated_at?: string
          user_id?: string
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      producao_diaria: {
        Row: {
          brigadeiro_id: string | null
          brigadeiro_nome: string
          created_at: string
          custo_total: number
          data: string
          deleted_at: string | null
          deleted_reason: string | null
          id: string
          quantidade: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          brigadeiro_id?: string | null
          brigadeiro_nome: string
          created_at?: string
          custo_total?: number
          data?: string
          deleted_at?: string | null
          deleted_reason?: string | null
          id?: string
          quantidade?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          brigadeiro_id?: string | null
          brigadeiro_nome?: string
          created_at?: string
          custo_total?: number
          data?: string
          deleted_at?: string | null
          deleted_reason?: string | null
          id?: string
          quantidade?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "producao_diaria_brigadeiro_id_fkey"
            columns: ["brigadeiro_id"]
            isOneToOne: false
            referencedRelation: "brigadeiros"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nome: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          nome?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nome?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recipientes: {
        Row: {
          capacidade_aproximada: number | null
          codigo: string
          created_at: string
          foto_url: string | null
          id: string
          observacoes: string | null
          peso_vazio: number
          status: string
          tipo_recipiente: string
          updated_at: string
          user_id: string
        }
        Insert: {
          capacidade_aproximada?: number | null
          codigo: string
          created_at?: string
          foto_url?: string | null
          id?: string
          observacoes?: string | null
          peso_vazio: number
          status?: string
          tipo_recipiente?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          capacidade_aproximada?: number | null
          codigo?: string
          created_at?: string
          foto_url?: string | null
          id?: string
          observacoes?: string | null
          peso_vazio?: number
          status?: string
          tipo_recipiente?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transacoes: {
        Row: {
          categoria: string
          created_at: string
          data: string
          descricao: string
          id: string
          referencia: string | null
          tipo: string
          user_id: string
          valor: number
        }
        Insert: {
          categoria: string
          created_at?: string
          data?: string
          descricao: string
          id?: string
          referencia?: string | null
          tipo: string
          user_id: string
          valor?: number
        }
        Update: {
          categoria?: string
          created_at?: string
          data?: string
          descricao?: string
          id?: string
          referencia?: string | null
          tipo?: string
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
