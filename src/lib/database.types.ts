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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action_type: string
          admin_email: string
          created_at: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          reason: string | null
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action_type: string
          admin_email: string
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          reason?: string | null
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action_type?: string
          admin_email?: string
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          reason?: string | null
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: []
      }
      directiva: {
        Row: {
          created_at: string
          email: string
          id: string
          nombre: string | null
          role: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          nombre?: string | null
          role?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          nombre?: string | null
          role?: string
        }
        Relationships: []
      }
      interview_booking_tokens: {
        Row: {
          created_at: string
          duration_hours: number
          expires_at: string | null
          id: string
          invited_at: string | null
          reminder_sent_at: string | null
          reschedule_count: number
          revoked_at: string | null
          solicitud_id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          duration_hours?: number
          expires_at?: string | null
          id?: string
          invited_at?: string | null
          reminder_sent_at?: string | null
          reschedule_count?: number
          revoked_at?: string | null
          solicitud_id: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          duration_hours?: number
          expires_at?: string | null
          id?: string
          invited_at?: string | null
          reminder_sent_at?: string | null
          reschedule_count?: number
          revoked_at?: string | null
          solicitud_id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interview_booking_tokens_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: true
            referencedRelation: "solicitudes"
            referencedColumns: ["id"]
          },
        ]
      }
      interview_days: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          duration_minutes: number
          end_time: string
          id: string
          meet_url: string | null
          notes: string | null
          season: string
          start_time: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          duration_minutes?: number
          end_time: string
          id?: string
          meet_url?: string | null
          notes?: string | null
          season: string
          start_time: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          duration_minutes?: number
          end_time?: string
          id?: string
          meet_url?: string | null
          notes?: string | null
          season?: string
          start_time?: string
        }
        Relationships: []
      }
      interviews: {
        Row: {
          cancelled_at: string | null
          created_at: string
          duration_minutes: number
          email_sent: boolean
          id: string
          meet_url: string | null
          notes: string | null
          reschedule_count: number
          slot_datetime: string
          solicitud_id: string
          status: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          duration_minutes?: number
          email_sent?: boolean
          id?: string
          meet_url?: string | null
          notes?: string | null
          reschedule_count?: number
          slot_datetime: string
          solicitud_id: string
          status?: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          duration_minutes?: number
          email_sent?: boolean
          id?: string
          meet_url?: string | null
          notes?: string | null
          reschedule_count?: number
          slot_datetime?: string
          solicitud_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "interviews_solicitud_id_fkey"
            columns: ["solicitud_id"]
            isOneToOne: false
            referencedRelation: "solicitudes"
            referencedColumns: ["id"]
          },
        ]
      }
      leaderboard_config: {
        Row: {
          accion: string
          categoria: string
          id: string
          multiplicador_externo: number | null
          multiplicador_sponsor: number | null
          orden: number | null
          permite_evento_externo: boolean | null
          permite_sponsor_alto_valor: boolean | null
          puntos_base: number
          requiere_horas: boolean | null
        }
        Insert: {
          accion: string
          categoria: string
          id: string
          multiplicador_externo?: number | null
          multiplicador_sponsor?: number | null
          orden?: number | null
          permite_evento_externo?: boolean | null
          permite_sponsor_alto_valor?: boolean | null
          puntos_base: number
          requiere_horas?: boolean | null
        }
        Update: {
          accion?: string
          categoria?: string
          id?: string
          multiplicador_externo?: number | null
          multiplicador_sponsor?: number | null
          orden?: number | null
          permite_evento_externo?: boolean | null
          permite_sponsor_alto_valor?: boolean | null
          puntos_base?: number
          requiere_horas?: boolean | null
        }
        Relationships: []
      }
      miembros_activos: {
        Row: {
          correo: string
          created_at: string | null
          id: string
          nombre: string
          numero_cuenta: string | null
          puntos_totales: number
          rol: string | null
          semestre: number | null
          telefono: string | null
        }
        Insert: {
          correo: string
          created_at?: string | null
          id?: string
          nombre: string
          numero_cuenta?: string | null
          puntos_totales?: number
          rol?: string | null
          semestre?: number | null
          telefono?: string | null
        }
        Update: {
          correo?: string
          created_at?: string | null
          id?: string
          nombre?: string
          numero_cuenta?: string | null
          puntos_totales?: number
          rol?: string | null
          semestre?: number | null
          telefono?: string | null
        }
        Relationships: []
      }
      periodos: {
        Row: {
          cerrado_at: string | null
          cerrado_por: string | null
          created_at: string | null
          es_activo: boolean | null
          formularios_cerrados: boolean
          id: string
          nombre: string
        }
        Insert: {
          cerrado_at?: string | null
          cerrado_por?: string | null
          created_at?: string | null
          es_activo?: boolean | null
          formularios_cerrados?: boolean
          id: string
          nombre: string
        }
        Update: {
          cerrado_at?: string | null
          cerrado_por?: string | null
          created_at?: string | null
          es_activo?: boolean | null
          formularios_cerrados?: boolean
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      puntos_registros: {
        Row: {
          config_id: string | null
          created_at: string | null
          es_evento_externo: boolean | null
          es_sponsor_alto_valor: boolean | null
          estado_aprobacion: string | null
          horas_reportadas: number | null
          id: string
          miembro_id: string
          notas_admin: string | null
          periodo_id: string
          puntos_aprobados: number | null
          puntos_solicitados: number
          reviewed_at: string | null
          reviewed_by: string | null
          url_evidencia: string | null
        }
        Insert: {
          config_id?: string | null
          created_at?: string | null
          es_evento_externo?: boolean | null
          es_sponsor_alto_valor?: boolean | null
          estado_aprobacion?: string | null
          horas_reportadas?: number | null
          id?: string
          miembro_id: string
          notas_admin?: string | null
          periodo_id: string
          puntos_aprobados?: number | null
          puntos_solicitados: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          url_evidencia?: string | null
        }
        Update: {
          config_id?: string | null
          created_at?: string | null
          es_evento_externo?: boolean | null
          es_sponsor_alto_valor?: boolean | null
          estado_aprobacion?: string | null
          horas_reportadas?: number | null
          id?: string
          miembro_id?: string
          notas_admin?: string | null
          periodo_id?: string
          puntos_aprobados?: number | null
          puntos_solicitados?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          url_evidencia?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "puntos_registros_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "leaderboard_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "puntos_registros_miembro_id_fkey"
            columns: ["miembro_id"]
            isOneToOne: false
            referencedRelation: "miembros_activos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "puntos_registros_miembro_id_fkey"
            columns: ["miembro_id"]
            isOneToOne: false
            referencedRelation: "ranking_por_periodo"
            referencedColumns: ["miembro_id"]
          },
          {
            foreignKeyName: "puntos_registros_periodo_id_fkey"
            columns: ["periodo_id"]
            isOneToOne: false
            referencedRelation: "periodos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "puntos_registros_periodo_id_fkey"
            columns: ["periodo_id"]
            isOneToOne: false
            referencedRelation: "ranking_por_periodo"
            referencedColumns: ["periodo_id"]
          },
        ]
      }
      seleccion_config: {
        Row: {
          active_season: string | null
          applications_closed: boolean
          closed_at: string | null
          closed_by: string | null
          default_booking_hours: number
          dispatch_paused: boolean
          id: boolean
          interview_deadline_at: string | null
          is_open: boolean
          next_season_hint: string | null
          opened_at: string | null
          opened_by: string | null
          progressive_enabled: boolean
          selection_revision: number
          selection_site_url: string
          updated_at: string
          whatsapp_url: string
        }
        Insert: {
          active_season?: string | null
          applications_closed?: boolean
          closed_at?: string | null
          closed_by?: string | null
          default_booking_hours?: number
          dispatch_paused?: boolean
          id?: boolean
          interview_deadline_at?: string | null
          is_open?: boolean
          next_season_hint?: string | null
          opened_at?: string | null
          opened_by?: string | null
          progressive_enabled?: boolean
          selection_revision?: number
          selection_site_url?: string
          updated_at?: string
          whatsapp_url?: string
        }
        Update: {
          active_season?: string | null
          applications_closed?: boolean
          closed_at?: string | null
          closed_by?: string | null
          default_booking_hours?: number
          dispatch_paused?: boolean
          id?: boolean
          interview_deadline_at?: string | null
          is_open?: boolean
          next_season_hint?: string | null
          opened_at?: string | null
          opened_by?: string | null
          progressive_enabled?: boolean
          selection_revision?: number
          selection_site_url?: string
          updated_at?: string
          whatsapp_url?: string
        }
        Relationships: []
      }
      solicitudes: {
        Row: {
          carrera: string
          correo: string
          created_at: string
          curiosidad: string
          cv_storage_path: string | null
          decision_exception_reason: string | null
          email_notification_sent: boolean
          eval_aporte_notes: string | null
          eval_aporte_score: number | null
          eval_blandas_notes: string | null
          eval_blandas_score: number | null
          eval_motivacion_notes: string | null
          eval_motivacion_score: number | null
          eval_overall_notes: string | null
          eval_proyectos_notes: string | null
          eval_proyectos_score: number | null
          eval_tecnica_notes: string | null
          eval_tecnica_score: number | null
          evaluated_at: string | null
          evaluated_by: string | null
          experiencia_liderazgo: string
          final_decision: string | null
          final_email_sent: boolean
          fortalezas_areas: string
          github_url: string | null
          horas_disponibles: string
          id: string
          intereses: string[] | null
          lenguajes: string[] | null
          linkedin_url: string | null
          manejo_conflicto: string
          motivacion: string
          nivel_experiencia: string | null
          nombre: string
          notes: string | null
          numero_cuenta: string
          portfolio_url: string | null
          proyecto_descripcion: string
          reviewed_at: string | null
          reviewed_by: string | null
          season: string
          selection_revision: number
          semestre: number
          status: string
        }
        Insert: {
          carrera: string
          correo: string
          created_at?: string
          curiosidad: string
          cv_storage_path?: string | null
          decision_exception_reason?: string | null
          email_notification_sent?: boolean
          eval_aporte_notes?: string | null
          eval_aporte_score?: number | null
          eval_blandas_notes?: string | null
          eval_blandas_score?: number | null
          eval_motivacion_notes?: string | null
          eval_motivacion_score?: number | null
          eval_overall_notes?: string | null
          eval_proyectos_notes?: string | null
          eval_proyectos_score?: number | null
          eval_tecnica_notes?: string | null
          eval_tecnica_score?: number | null
          evaluated_at?: string | null
          evaluated_by?: string | null
          experiencia_liderazgo: string
          final_decision?: string | null
          final_email_sent?: boolean
          fortalezas_areas: string
          github_url?: string | null
          horas_disponibles: string
          id?: string
          intereses?: string[] | null
          lenguajes?: string[] | null
          linkedin_url?: string | null
          manejo_conflicto: string
          motivacion: string
          nivel_experiencia?: string | null
          nombre: string
          notes?: string | null
          numero_cuenta: string
          portfolio_url?: string | null
          proyecto_descripcion: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          season: string
          selection_revision?: number
          semestre: number
          status?: string
        }
        Update: {
          carrera?: string
          correo?: string
          created_at?: string
          curiosidad?: string
          cv_storage_path?: string | null
          decision_exception_reason?: string | null
          email_notification_sent?: boolean
          eval_aporte_notes?: string | null
          eval_aporte_score?: number | null
          eval_blandas_notes?: string | null
          eval_blandas_score?: number | null
          eval_motivacion_notes?: string | null
          eval_motivacion_score?: number | null
          eval_overall_notes?: string | null
          eval_proyectos_notes?: string | null
          eval_proyectos_score?: number | null
          eval_tecnica_notes?: string | null
          eval_tecnica_score?: number | null
          evaluated_at?: string | null
          evaluated_by?: string | null
          experiencia_liderazgo?: string
          final_decision?: string | null
          final_email_sent?: boolean
          fortalezas_areas?: string
          github_url?: string | null
          horas_disponibles?: string
          id?: string
          intereses?: string[] | null
          lenguajes?: string[] | null
          linkedin_url?: string | null
          manejo_conflicto?: string
          motivacion?: string
          nivel_experiencia?: string | null
          nombre?: string
          notes?: string | null
          numero_cuenta?: string
          portfolio_url?: string | null
          proyecto_descripcion?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          season?: string
          selection_revision?: number
          semestre?: number
          status?: string
        }
        Relationships: []
      }
    }
    Views: {
      ranking_por_periodo: {
        Row: {
          es_activo: boolean | null
          miembro_id: string | null
          nombre: string | null
          periodo_id: string | null
          periodo_nombre: string | null
          puntos_totales: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      approve_puntos: {
        Args: {
          p_admin_email: string
          p_notas: string
          p_puntos_aprobados: number
          p_registro_id: string
        }
        Returns: undefined
      }
      book_interview: {
        Args: { p_slot: string; p_token: string }
        Returns: Json
      }
      cancel_interview: { Args: { p_token: string }; Returns: Json }
      delete_puntos_registro: {
        Args: { p_admin_email: string; p_reason: string; p_registro_id: string }
        Returns: undefined
      }
      get_booking_state: { Args: { p_token: string }; Returns: Json }
      insert_ajuste_manual: {
        Args: {
          p_admin_email: string
          p_cantidad: number
          p_miembro_id: string
          p_motivo: string
          p_tipo: string
        }
        Returns: string
      }
      insert_manual_puntos:
        | {
            Args: {
              p_admin_email: string
              p_miembro_id: string
              p_notas: string
              p_puntos: number
            }
            Returns: undefined
          }
        | {
            Args: {
              p_admin_email: string
              p_miembro_id: string
              p_notas: string
              p_periodo_id: string
              p_puntos: number
            }
            Returns: undefined
          }
      is_email_in_directiva: { Args: { p_email: string }; Returns: boolean }
      reject_puntos: {
        Args: { p_admin_email: string; p_notas: string; p_registro_id: string }
        Returns: undefined
      }
      revocar_ajuste_manual: {
        Args: {
          p_admin_email: string
          p_motivo_revocacion: string
          p_registro_id: string
        }
        Returns: undefined
      }
      selection_admin: {
        Args: { p_action: string; p_data?: Json }
        Returns: Json
      }
      selection_worker: {
        Args: { p_action: string; p_data?: Json }
        Returns: Json
      }
      toggle_periodo_cerrado: {
        Args: { p_admin_email: string; p_periodo_id: string }
        Returns: boolean
      }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
