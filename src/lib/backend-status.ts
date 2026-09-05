/**
 * Puente de solo-lectura entre el front del panel admin y el nuevo
 * backend de selecciones (RPC `selection_admin`).
 *
 * Diseñado para NO romper nunca el front:
 * - Toda la lógica vive aquí; no depende de archivos fuera del repo
 *   commiteado (solo `@lib/supabase`, que ya usa cada página legacy).
 * - Cualquier fallo (sin sesión, sin permisos, RPC ausente, red) deja la
 *   pill en estado informativo y la página sigue intacta.
 * - No oculta, mueve ni deshabilita ningún elemento existente.
 *
 * NOTA: replica a propósito solo la detección de modo de
 * `getSelectionFeatureMode()` para no acoplar el deploy a módulos nuevos
 * sin revisar. Cuando se cableen acciones progresivas, este puente debe
 * migrar a `@lib/selection-client` como única fuente de verdad.
 */

import { supabase } from '@lib/supabase';

type RpcResponse = {
  data: unknown;
  error: { message?: string } | null;
};

type SelectionStateLike = {
  config?: { progressive_enabled?: unknown };
  messages?: Array<{ status?: unknown }>;
  [key: string]: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeRpcData(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

const PILL_BASE_STYLE = [
  'display:inline-flex',
  'align-items:center',
  'gap:6px',
  'margin-left:12px',
  'padding:3px 10px',
  'font-size:.75rem',
  'font-weight:800',
  'text-transform:uppercase',
  'letter-spacing:.04em',
  'border:2px solid #5b21b6',
  'background:#ede9fe',
  'color:#5b21b6',
  'vertical-align:middle',
].join(';');

type PillTone = 'info' | 'ok' | 'warn' | 'bad';

const TONES: Record<PillTone, { bg: string; fg: string; border: string }> = {
  info: { bg: '#ede9fe', fg: '#5b21b6', border: '#5b21b6' },
  ok: { bg: '#d1fae5', fg: '#065f46', border: '#065f46' },
  warn: { bg: '#fef3c7', fg: '#92400e', border: '#92400e' },
  bad: { bg: '#fee2e2', fg: '#991b1b', border: '#991b1b' },
};

function paint(pill: HTMLElement, text: string, tone: PillTone): void {
  const t = TONES[tone];
  pill.textContent = '';
  const icon = document.createElement('i');
  icon.className = 'bi bi-cpu';
  icon.setAttribute('aria-hidden', 'true');
  pill.append(icon, document.createTextNode(` ${text}`));
  pill.style.background = t.bg;
  pill.style.color = t.fg;
  pill.style.borderColor = t.border;
}

/**
 * Rellena la pill `#backend-status` con el modo del nuevo backend.
 * Seguro para llamar desde cualquier página del panel admin.
 */
export async function paintBackendStatus(pillId = 'backend-status'): Promise<void> {
  const pill = document.getElementById(pillId);
  if (!pill) return;
  if (!pill.hasAttribute('style')) pill.setAttribute('style', PILL_BASE_STYLE);
  pill.setAttribute('title', 'Conexión con el nuevo backend de selecciones (solo lectura)');

  try {
    const client = supabase as unknown as {
      rpc(name: string, params: Record<string, unknown>): Promise<RpcResponse>;
    };
    const response = await client.rpc('selection_admin', { p_action: 'state', p_data: {} });
    if (response.error) {
      paint(pill, 'Backend: sin conexión', 'bad');
      return;
    }
    const normalized = normalizeRpcData(response.data);
    if (isRecord(normalized) && isRecord(normalized.error)) {
      paint(pill, 'Backend: sin conexión', 'bad');
      return;
    }
    const state = (normalized ?? {}) as SelectionStateLike;
    const enabled = state.config?.progressive_enabled;
    if (enabled === true) {
      const queued = (state.messages ?? []).filter((m) =>
        ['queued', 'sending', 'uncertain'].includes(String(m.status ?? '')),
      ).length;
      paint(pill, `Backend: progresivo${queued > 0 ? ` · ${queued} en cola` : ''}`, 'ok');
    } else if (enabled === false) {
      paint(pill, 'Backend: legacy ✓', 'info');
    } else {
      paint(pill, 'Backend: sin conexión', 'bad');
    }
  } catch {
    paint(pill, 'Backend: no verificado', 'warn');
  }
}
