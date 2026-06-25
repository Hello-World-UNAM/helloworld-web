// Auto-generated stub. Will be replaced by `supabase gen types typescript` output.
// Until migrations apply, this is a hand-written placeholder.

export type Database = {
  public: {
    Tables: {
      solicitudes: {
        Row: {
          id: string;
          season: string;
          status: 'pending' | 'reviewing' | 'accepted' | 'rejected';
          created_at: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          notes: string | null;
          email_notification_sent: boolean;
          nombre: string;
          numero_cuenta: string;
          correo: string;
          carrera: string;
          semestre: number;
          intereses: string[] | null;
          lenguajes: string[] | null;
          nivel_experiencia: string | null;
          proyecto_descripcion: string;
          github_url: string | null;
          linkedin_url: string | null;
          portfolio_url: string | null;
          cv_storage_path: string | null;
          motivacion: string;
          experiencia_liderazgo: string;
          manejo_conflicto: string;
          fortalezas_areas: string;
          curiosidad: string;
          horas_disponibles: string;
          eval_blandas_score: number | null;
          eval_blandas_notes: string | null;
          eval_motivacion_score: number | null;
          eval_motivacion_notes: string | null;
          eval_proyectos_score: number | null;
          eval_proyectos_notes: string | null;
          eval_aporte_score: number | null;
          eval_aporte_notes: string | null;
          eval_tecnica_score: number | null;
          eval_tecnica_notes: string | null;
          eval_overall_notes: string | null;
          evaluated_by: string | null;
          evaluated_at: string | null;
          final_decision: 'accepted' | 'rejected' | null;
          final_email_sent: boolean;
        };
        Insert: Omit<
          Database['public']['Tables']['solicitudes']['Row'],
          'id' | 'created_at' | 'status' | 'reviewed_at' | 'reviewed_by' | 'notes' | 'email_notification_sent'
        > & {
          id?: string;
          status?: 'pending' | 'reviewing' | 'accepted' | 'rejected';
        };
        Update: Partial<Database['public']['Tables']['solicitudes']['Row']>;
      };
      directiva: {
        Row: {
          id: string;
          email: string;
          nombre: string | null;
          role: 'admin' | 'reviewer';
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          nombre?: string | null;
          role?: 'admin' | 'reviewer';
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['directiva']['Row']>;
      };
      interview_days: {
        Row: {
          id: string;
          season: string;
          date: string;
          start_time: string;
          end_time: string;
          duration_minutes: number;
          meet_url: string | null;
          notes: string | null;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          season: string;
          date: string;
          start_time: string;
          end_time: string;
          duration_minutes?: number;
          meet_url?: string | null;
          notes?: string | null;
          created_at?: string;
          created_by?: string | null;
        };
        Update: Partial<Database['public']['Tables']['interview_days']['Row']>;
      };
      interviews: {
        Row: {
          id: string;
          solicitud_id: string;
          slot_datetime: string;
          duration_minutes: number;
          meet_url: string | null;
          status: 'confirmed' | 'cancelled' | 'completed' | 'no_show';
          reschedule_count: number;
          email_sent: boolean;
          created_at: string;
          cancelled_at: string | null;
          notes: string | null;
        };
        Insert: never;
        Update: Partial<Database['public']['Tables']['interviews']['Row']>;
      };
      interview_booking_tokens: {
        Row: {
          id: string;
          solicitud_id: string;
          token: string;
          reschedule_count: number;
          created_at: string;
          used_at: string | null;
        };
        Insert: never;
        Update: never;
      };
      seleccion_config: {
        Row: {
          id: boolean;
          is_open: boolean;
          active_season: string | null;
          next_season_hint: string | null;
          interview_deadline_at: string | null;
          whatsapp_url: string;
          applications_closed: boolean;
          opened_at: string | null;
          opened_by: string | null;
          closed_at: string | null;
          closed_by: string | null;
          updated_at: string;
        };
        Insert: never;
        Update: Partial<Pick<
          Database['public']['Tables']['seleccion_config']['Row'],
          'is_open' | 'active_season' | 'next_season_hint' | 'interview_deadline_at' | 'whatsapp_url' | 'applications_closed' | 'opened_at' | 'opened_by' | 'closed_at' | 'closed_by'
        >>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
