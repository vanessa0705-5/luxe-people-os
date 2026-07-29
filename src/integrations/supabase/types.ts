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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      colaborador_dependentes: {
        Row: {
          colaborador_id: string
          cpf: string | null
          created_at: string
          data_nascimento: string | null
          id: string
          nome_completo: string
          parentesco: string
          updated_at: string
          usa_ir: boolean
          usa_salario_familia: boolean
        }
        Insert: {
          colaborador_id: string
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          id?: string
          nome_completo: string
          parentesco: string
          updated_at?: string
          usa_ir?: boolean
          usa_salario_familia?: boolean
        }
        Update: {
          colaborador_id?: string
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          id?: string
          nome_completo?: string
          parentesco?: string
          updated_at?: string
          usa_ir?: boolean
          usa_salario_familia?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "colaborador_dependentes_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      colaboradores: {
        Row: {
          agencia: string | null
          bairro: string | null
          banco: string | null
          cargo: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          conta: string | null
          cpf: string
          created_at: string
          created_by: string | null
          ctps_numero: string | null
          ctps_serie: string | null
          data_admissao: string | null
          data_desligamento: string | null
          data_nascimento: string | null
          departamento: string | null
          email: string | null
          estado_civil: Database["public"]["Enums"]["estado_civil"] | null
          funcao: string | null
          id: string
          jornada_semanal: number | null
          logradouro: string | null
          matricula: string | null
          nacionalidade: string | null
          nome_completo: string
          numero: string | null
          observacoes: string | null
          pis_pasep: string | null
          reservista: string | null
          rg: string | null
          rg_orgao_emissor: string | null
          salario: number | null
          sexo: Database["public"]["Enums"]["sexo"] | null
          status: Database["public"]["Enums"]["status_colaborador"]
          telefone: string | null
          tipo_contrato: Database["public"]["Enums"]["tipo_contrato"] | null
          titulo_eleitor: string | null
          titulo_secao: string | null
          titulo_zona: string | null
          tomador_id: string
          uf: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          agencia?: string | null
          bairro?: string | null
          banco?: string | null
          cargo?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          conta?: string | null
          cpf: string
          created_at?: string
          created_by?: string | null
          ctps_numero?: string | null
          ctps_serie?: string | null
          data_admissao?: string | null
          data_desligamento?: string | null
          data_nascimento?: string | null
          departamento?: string | null
          email?: string | null
          estado_civil?: Database["public"]["Enums"]["estado_civil"] | null
          funcao?: string | null
          id?: string
          jornada_semanal?: number | null
          logradouro?: string | null
          matricula?: string | null
          nacionalidade?: string | null
          nome_completo: string
          numero?: string | null
          observacoes?: string | null
          pis_pasep?: string | null
          reservista?: string | null
          rg?: string | null
          rg_orgao_emissor?: string | null
          salario?: number | null
          sexo?: Database["public"]["Enums"]["sexo"] | null
          status?: Database["public"]["Enums"]["status_colaborador"]
          telefone?: string | null
          tipo_contrato?: Database["public"]["Enums"]["tipo_contrato"] | null
          titulo_eleitor?: string | null
          titulo_secao?: string | null
          titulo_zona?: string | null
          tomador_id: string
          uf?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          agencia?: string | null
          bairro?: string | null
          banco?: string | null
          cargo?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          conta?: string | null
          cpf?: string
          created_at?: string
          created_by?: string | null
          ctps_numero?: string | null
          ctps_serie?: string | null
          data_admissao?: string | null
          data_desligamento?: string | null
          data_nascimento?: string | null
          departamento?: string | null
          email?: string | null
          estado_civil?: Database["public"]["Enums"]["estado_civil"] | null
          funcao?: string | null
          id?: string
          jornada_semanal?: number | null
          logradouro?: string | null
          matricula?: string | null
          nacionalidade?: string | null
          nome_completo?: string
          numero?: string | null
          observacoes?: string | null
          pis_pasep?: string | null
          reservista?: string | null
          rg?: string | null
          rg_orgao_emissor?: string | null
          salario?: number | null
          sexo?: Database["public"]["Enums"]["sexo"] | null
          status?: Database["public"]["Enums"]["status_colaborador"]
          telefone?: string | null
          tipo_contrato?: Database["public"]["Enums"]["tipo_contrato"] | null
          titulo_eleitor?: string | null
          titulo_secao?: string | null
          titulo_zona?: string | null
          tomador_id?: string
          uf?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "colaboradores_tomador_id_fkey"
            columns: ["tomador_id"]
            isOneToOne: false
            referencedRelation: "tomadores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          job_title: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          is_active?: boolean
          job_title?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          job_title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tomadores: {
        Row: {
          cnpj: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          nome_fantasia: string | null
          razao_social: string
          updated_at: string
        }
        Insert: {
          cnpj: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          nome_fantasia?: string | null
          razao_social: string
          updated_at?: string
        }
        Update: {
          cnpj?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          nome_fantasia?: string | null
          razao_social?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_principal: { Args: { _user_id: string }; Returns: boolean }
      pode_gerenciar_rh: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin_principal" | "rh" | "gestor" | "consulta"
      estado_civil:
        | "solteiro"
        | "casado"
        | "divorciado"
        | "viuvo"
        | "uniao_estavel"
      sexo: "masculino" | "feminino" | "outro"
      status_colaborador: "ativo" | "afastado" | "ferias" | "desligado"
      tipo_contrato: "clt" | "pj" | "temporario" | "estagio" | "terceirizado"
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
    Enums: {
      app_role: ["admin_principal", "rh", "gestor", "consulta"],
      estado_civil: [
        "solteiro",
        "casado",
        "divorciado",
        "viuvo",
        "uniao_estavel",
      ],
      sexo: ["masculino", "feminino", "outro"],
      status_colaborador: ["ativo", "afastado", "ferias", "desligado"],
      tipo_contrato: ["clt", "pj", "temporario", "estagio", "terceirizado"],
    },
  },
} as const
