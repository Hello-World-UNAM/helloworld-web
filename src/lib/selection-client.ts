import { supabase } from '@lib/supabase';
import {
  renderSelectionMail,
  type SelectionMailPayload,
} from '../../supabase/functions/_shared/selection-mail';

export type SelectionStatus = 'pending' | 'reviewing' | 'accepted' | 'rejected';
export type FinalDecision = 'accepted' | 'rejected';
export type InterviewStatus = 'confirmed' | 'completed' | 'no_show' | 'cancelled';
export type SelectionPage = 'solicitudes' | 'entrevistas' | 'detalle' | 'config';
export type SelectionMessageKind = 'initial' | 'final' | 'reminder' | 'confirmation' | 'rectification' | 'manual' | string;
export type SelectionMessageStatus = 'queued' | 'sending' | 'accepted' | 'failed' | 'uncertain' | 'cancelled' | 'manual' | string;
export type SelectionDeliveryStatus = 'pending' | 'sent' | 'delivered' | 'bounced' | 'delayed' | 'failed' | 'complained' | string;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type SelectionAction =
  | 'state'
  | 'save'
  | 'preview'
  | 'confirm'
  | 'extend'
  | 'rectify'
  | 'manual'
  | 'email'
  | 'retry'
  | 'interview'
  | 'day'
  | 'config';

export interface SelectionConfig {
  id?: boolean;
  is_open?: boolean;
  active_season?: string | null;
  applications_closed?: boolean;
  interview_deadline_at?: string | null;
  progressive_enabled?: boolean;
  dispatch_paused?: boolean;
  default_booking_hours?: number;
  selection_revision?: number;
  revision?: number;
  whatsapp_url?: string | null;
  [key: string]: unknown;
}

export interface SelectionSolicitud {
  id: string;
  season: string;
  status: SelectionStatus;
  nombre: string;
  correo: string;
  carrera: string;
  semestre: number;
  created_at: string;
  notes?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  final_decision?: FinalDecision | null;
  evaluated_at?: string | null;
  evaluated_by?: string | null;
  final_email_sent?: boolean;
  email_notification_sent?: boolean;
  selection_revision?: number;
  revision?: number;
  [key: string]: unknown;
}

export interface SelectionInvitation {
  solicitud_id: string;
  expires_at: string | null;
  invited_at: string | null;
  revoked_at: string | null;
  reschedule_count: number;
  [key: string]: unknown;
}

export interface SelectionInterview {
  id: string;
  solicitud_id: string;
  slot_datetime: string;
  duration_minutes: number;
  meet_url?: string | null;
  status: InterviewStatus;
  reschedule_count?: number;
  notes?: string | null;
  created_at?: string;
  cancelled_at?: string | null;
  [key: string]: unknown;
}

export interface SelectionDay {
  id: string;
  season: string;
  date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  meet_url?: string | null;
  notes?: string | null;
  [key: string]: unknown;
}

export interface SelectionMessage {
  id: string;
  solicitud_id?: string | null;
  kind: SelectionMessageKind;
  status?: SelectionMessageStatus | null;
  delivery_status?: SelectionDeliveryStatus | null;
  created_at: string;
  last_error?: string | null;
  provider_id?: string | null;
  [key: string]: unknown;
}

export interface SelectionEvent {
  id?: string;
  solicitud_id?: string | null;
  action?: string;
  kind?: string;
  created_at?: string;
  actor_email?: string | null;
  [key: string]: unknown;
}

export interface SelectionState {
  config: SelectionConfig;
  capacity?: number | Record<string, unknown> | null;
  solicitudes: SelectionSolicitud[];
  invitations: SelectionInvitation[];
  interviews: SelectionInterview[];
  days: SelectionDay[];
  messages: SelectionMessage[];
  events: SelectionEvent[];
  [key: string]: unknown;
}

export interface SelectionPreviewItem {
  id: string;
  revision: number;
  nombre: string;
  correo: string;
  season?: string;
  decision: string;
  kind: 'initial' | 'final';
  subject: string;
  body: string;
  payload?: Partial<SelectionMailPayload>;
}

export interface SelectionPreview {
  items: SelectionPreviewItem[];
  duration_hours?: number;
  config_revision?: number;
  capacity?: Record<string, unknown> | number | null;
  errors: Array<{ id?: string; message?: string; [key: string]: unknown }>;
}

export interface SelectionConfirmResult {
  batch_id: string;
  queued: number;
  [key: string]: unknown;
}

export interface SelectionCommunicationDraft {
  kind: 'initial' | 'final';
  items: Array<{ id: string; revision: number }>;
  duration_hours: number;
  preview: SelectionPreview;
}

const PREVIEW_BOOKING_URL = 'https://helloworld-unam.tech/seleccion/agendar?t=ENLACE_PERSONAL';

/**
 * The database validates the batch and returns its payload. Rendering here
 * keeps the admin preview byte-for-byte aligned with the dispatch worker's
 * shared template while making the personal-link placeholder explicit.
 */
export function renderSelectionPreviewItem(item: SelectionPreviewItem): SelectionPreviewItem {
  const rawPayload = item.payload && typeof item.payload === 'object' ? item.payload : {};
  const payload: SelectionMailPayload = {
    nombre: String(rawPayload.nombre ?? item.nombre),
    season: String(rawPayload.season ?? item.season ?? 'temporada seleccionada'),
    decision: (rawPayload.decision ?? item.decision) as SelectionMailPayload['decision'],
    stage: item.kind === 'final' ? 'final' : 'initial',
    expires_at: rawPayload.expires_at == null ? undefined : String(rawPayload.expires_at),
    booking_url: rawPayload.booking_url == null ? undefined : String(rawPayload.booking_url),
    duration_minutes: rawPayload.duration_minutes == null ? undefined : Number(rawPayload.duration_minutes),
    whatsapp_url: rawPayload.whatsapp_url == null ? undefined : String(rawPayload.whatsapp_url),
    interview_outcome: rawPayload.interview_outcome == null ? undefined : (String(rawPayload.interview_outcome) as SelectionMailPayload['interview_outcome']),
  };

  if (item.kind === 'initial' && item.decision === 'accepted' && !payload.booking_url) {
    payload.booking_url = PREVIEW_BOOKING_URL;
  }

  const rendered = renderSelectionMail(item.kind, payload);
  return { ...item, subject: rendered.subject, body: rendered.text, payload };
}

type RpcClient = {
  rpc(
    name: string,
    params: Record<string, JsonValue>,
  ): Promise<{ data: unknown; error: { message?: string } | null }>;
};

const rpcClient = supabase as unknown as RpcClient;

export class SelectionClientError extends Error {
  readonly causeValue: unknown;

  constructor(message: string, causeValue?: unknown) {
    super(message);
    this.name = 'SelectionClientError';
    this.causeValue = causeValue;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function messageFrom(value: unknown, fallback = 'No se pudo completar la operación.') {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (isRecord(value) && typeof value.message === 'string' && value.message.trim()) {
    return value.message.trim();
  }
  return fallback;
}

function normalizeRpcData(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

/** Call the single authenticated admin contract used by the progressive UI. */
export async function selectionAdmin<T = unknown>(
  action: SelectionAction,
  data: Record<string, unknown> = {},
): Promise<T> {
  let response: { data: unknown; error: { message?: string } | null };
  try {
    response = await rpcClient.rpc('selection_admin', {
      p_action: action,
      p_data: data as JsonValue,
    });
  } catch (error) {
    throw new SelectionClientError(messageFrom(error), error);
  }

  if (response.error) {
    throw new SelectionClientError(messageFrom(response.error), response.error);
  }

  const normalized = normalizeRpcData(response.data);
  if (isRecord(normalized) && isRecord(normalized.error)) {
    throw new SelectionClientError(messageFrom(normalized.error), normalized.error);
  }

  return normalized as T;
}

/**
 * Local-only contracts used by the Selection Lab. They are deliberately
 * separate from selection_admin so the production clock guard remains part
 * of the normal workflow.
 */
async function selectionLabRpc<T = unknown>(
  name: string,
  params: Record<string, JsonValue>,
): Promise<T> {
  let response: { data: unknown; error: { message?: string } | null };
  try {
    response = await rpcClient.rpc(name, params);
  } catch (error) {
    throw new SelectionClientError(messageFrom(error), error);
  }

  if (response.error) {
    throw new SelectionClientError(messageFrom(response.error), response.error);
  }

  const normalized = normalizeRpcData(response.data);
  if (isRecord(normalized) && isRecord(normalized.error)) {
    throw new SelectionClientError(messageFrom(normalized.error), normalized.error);
  }

  return normalized as T;
}

export function selectionLabSaveEvaluation(data: Record<string, unknown>) {
  return selectionLabRpc('selection_lab_save_evaluation', {
    p_data: data as unknown as JsonValue,
  });
}

export function selectionLabCompleteInterview(interviewId: string) {
  return selectionLabRpc('selection_lab_complete_interview', {
    p_interview_id: interviewId,
  });
}

export async function getSelectionState(season?: string): Promise<SelectionState> {
  const data = season?.trim() ? { season: season.trim() } : {};
  return selectionAdmin<SelectionState>('state', data);
}

export async function previewSelectionCommunication(
  kind: 'initial' | 'final',
  rows: SelectionSolicitud[],
  durationHours?: number,
): Promise<SelectionCommunicationDraft> {
  const items = rows.map(revisionItem);
  const requestedHours = durationHours ?? 168;
  const [preview, state] = await Promise.all([
    selectionAdmin<SelectionPreview>('preview', {
      kind,
      items,
      duration_hours: requestedHours,
    }),
    kind === 'final' ? getSelectionState(rows[0]?.season) : Promise.resolve(undefined),
  ]);

  const interviewOutcomeBySolicitud = new Map<string, SelectionMailPayload['interview_outcome']>();
  if (state) {
    for (const row of rows) {
      const interviews = state.interviews.filter((interview) => interview.solicitud_id === row.id);
      const outcome = interviews.some((interview) => interview.status === 'completed')
        ? 'completed'
        : interviews.some((interview) => interview.status === 'no_show')
          ? 'no_show'
          : 'none';
      interviewOutcomeBySolicitud.set(row.id, outcome);
    }
  }

  return {
    kind,
    items,
    duration_hours: preview.duration_hours ?? requestedHours,
    preview: {
      ...preview,
      items: preview.items.map((item) =>
        renderSelectionPreviewItem({
          ...item,
          payload: {
            ...item.payload,
            ...(kind === 'final'
              ? {
                  interview_outcome: interviewOutcomeBySolicitud.get(item.id) ?? 'none',
                }
              : {}),
          },
        }),
      ),
    },
  };
}

export async function confirmSelectionCommunication(
  draft: SelectionCommunicationDraft,
): Promise<SelectionConfirmResult> {
  return selectionAdmin<SelectionConfirmResult>('confirm', {
    kind: draft.kind,
    items: draft.items,
    duration_hours: draft.duration_hours,
    config_revision: draft.preview.config_revision,
    request_id: newRequestId(),
  });
}

export type SelectionFeatureMode = {
  mode: 'progressive' | 'legacy' | 'unavailable';
  state?: SelectionState;
  error?: unknown;
};

/** A missing feature flag is not permission to run either workflow. */
export async function getSelectionFeatureMode(): Promise<SelectionFeatureMode> {
  try {
    const state = await getSelectionState();
    const enabled = state.config?.progressive_enabled;
    if (enabled !== true && enabled !== false) {
      return { mode: 'unavailable', state, error: new SelectionClientError('FEATURE_FLAG_UNAVAILABLE') };
    }
    return {
      mode: enabled ? 'progressive' : 'legacy',
      state,
    };
  } catch (error) {
    return { mode: 'unavailable', error };
  }
}

export async function isProgressiveSelectionEnabled(): Promise<boolean> {
  const result = await getSelectionFeatureMode();
  return result.mode === 'progressive';
}

export function selectionRevision(row: SelectionSolicitud): number {
  const candidate = row.selection_revision ?? row.revision;
  const numeric = typeof candidate === 'number' ? candidate : Number(candidate);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function revisionItem(row: SelectionSolicitud): { id: string; revision: number } {
  return { id: row.id, revision: selectionRevision(row) };
}

export function newRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `selection-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function errorMessage(error: unknown): string {
  return messageFrom(error);
}

const SELECTION_ERROR_LABELS: Record<string, string> = {
  ALREADY_NOTIFIED: 'Esta decisión ya fue comunicada.',
  COMMUNICATION_EXISTS_USE_RETRY_OR_RECTIFY: 'Ya existe una comunicación para esta decisión. Usa reintento o rectificación.',
  DISPATCH_PAUSED: 'El despacho de correos está pausado en configuración.',
  HISTORICAL_READ_ONLY: 'La temporada histórica es de sólo lectura.',
  INSUFFICIENT_CAPACITY: 'No hay suficientes horarios libres para estas invitaciones.',
  INTERVIEW_IN_FUTURE: 'La entrevista aún no ha ocurrido: está programada para una fecha y hora futuras. En producción debes esperar a realizarla.',
  INTERVIEW_OR_EXCEPTION_REQUIRED: 'Para aceptar se requiere una entrevista completada o un motivo de excepción.',
  INVALID_DAY_OR_MEET: 'La fecha debe ser futura y la URL debe ser de Google Meet.',
  PROGRESSIVE_DISABLED: 'El flujo progresivo no está activo.',
  RESOLVE_RESERVATION_FIRST: 'Primero resuelve la entrevista que aún está confirmada.',
  STALE_INTERVIEW: 'La entrevista cambió. Actualiza la página e inténtalo de nuevo.',
  STALE_PREVIEW: 'El proceso cambió desde la previsualización. Revisa el lote otra vez.',
  STALE_SELECTION: 'Los datos cambiaron. Actualiza la página antes de guardar.',
  USE_RECTIFICATION: 'La decisión ya fue comunicada; cualquier cambio debe registrarse como rectificación.',
  USE_SELECTION_RPC: 'Esta acción debe realizarse mediante el flujo progresivo.',
};

export function selectionErrorMessage(error: unknown): string {
  const raw = errorMessage(error);
  const code = Object.keys(SELECTION_ERROR_LABELS).find((candidate) => raw.includes(candidate));
  return code ? SELECTION_ERROR_LABELS[code] : raw;
}

export function isStaleSelectionError(error: unknown): boolean {
  return /stale|revision|versi[oó]n|concurr|conflict|obsolet|actualiz/i.test(errorMessage(error));
}

/**
 * Ocupación de una etapa de comunicación según state.messages.
 * Espeja el guard del backend (COMMUNICATION_EXISTS_USE_RETRY_OR_RECTIFY)
 * y distingue entrega real (`sent`) de encolado. No cambia protecciones
 * del backend: sólo permite que la UI las refleje.
 */
export type CommsOccupancy = 'free' | 'queued' | 'failed' | 'uncertain' | 'sent';

const STAGE_MESSAGE_STATUSES = ['queued', 'sending', 'uncertain', 'accepted', 'failed'];
const FAILED_DELIVERIES = ['bounced', 'failed', 'complained'];

function rectificationStage(message: SelectionMessage): 'initial' | 'final' | null {
  const payload = (message as { payload?: unknown }).payload;
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const stage = (payload as Record<string, unknown>).stage;
    if (stage === 'initial' || stage === 'final') return stage;
  }
  return null;
}

export function stageCommsOccupancy(
  messages: SelectionMessage[] | undefined,
  solicitudId: string,
  stage: 'initial' | 'final',
  alreadyNotified = false,
): CommsOccupancy {
  const relevant = (messages ?? []).filter((message) => {
    if (message.solicitud_id !== solicitudId) return false;
    const kind = String(message.kind ?? '');
    const messageStage = kind === 'rectification' ? (rectificationStage(message) ?? stage) : kind;
    if (messageStage !== stage) return false;
    return STAGE_MESSAGE_STATUSES.includes(String(message.status ?? ''));
  });
  if (relevant.some((message) =>
    String(message.status) === 'failed' || FAILED_DELIVERIES.includes(String(message.delivery_status ?? '')),
  )) return 'failed';
  if (relevant.some((message) => String(message.status) === 'uncertain')) return 'uncertain';
  if (relevant.some((message) => {
    const status = String(message.status ?? '');
    return status === 'queued' || status === 'sending' ||
      (status === 'accepted' && String(message.delivery_status ?? '') !== 'delivered');
  })) return 'queued';
  if (relevant.some((message) =>
    String(message.status) === 'accepted' && String(message.delivery_status ?? '') === 'delivered',
  )) return 'sent';
  return alreadyNotified ? 'sent' : 'free';
}

export function commsOccupancyLabel(occupancy: Exclude<CommsOccupancy, 'free'>): string {
  if (occupancy === 'failed') return 'El envío falló: usa Reintentar/revisión, no un comunicar normal.';
  if (occupancy === 'uncertain') return 'Envío incierto: no reenviar automáticamente; revisar entrega.';
  if (occupancy === 'sent') return 'Comunicación entregada.';
  return 'Comunicación en cola: espera la entrega antes de intentar de nuevo.';
}
