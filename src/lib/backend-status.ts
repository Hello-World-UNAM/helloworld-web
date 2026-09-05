/**
 * Puente de solo-lectura entre el front legacy del panel admin y el nuevo
 * backend de selecciones (RPC `selection_admin`).
 *
 * Diseñado para NO romper nunca el front anterior:
 * - El cliente nuevo se carga con `import()` dinámico dentro de try/catch.
 * - Si el backend no responde, falta sesión o el flag no existe, la pill
 *   muestra "sin conexión" y el resto de la página sigue intacto.
 * - No oculta, mueve ni deshabilita ningún elemento legacy.
 */

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
 * Seguro para llamar desde cualquier página legacy del panel admin.
 */
export async function paintBackendStatus(pillId = 'backend-status'): Promise<void> {
  const pill = document.getElementById(pillId);
  if (!pill) return;
  if (!pill.hasAttribute('style')) pill.setAttribute('style', PILL_BASE_STYLE);
  pill.setAttribute('title', 'Conexión con el nuevo backend de selecciones (solo lectura)');

  try {
    const mod = await import('./selection-client');
    const feature = await mod.getSelectionFeatureMode();
    if (feature.mode === 'progressive') {
      const messages = feature.state?.messages ?? [];
      const queued = messages.filter((m) =>
        ['queued', 'sending', 'uncertain'].includes(String(m.status ?? '')),
      ).length;
      paint(pill, `Backend: progresivo${queued > 0 ? ` · ${queued} en cola` : ''}`, 'ok');
    } else if (feature.mode === 'legacy') {
      paint(pill, 'Backend: legacy ✓', 'info');
    } else {
      paint(pill, 'Backend: sin conexión', 'bad');
    }
  } catch {
    paint(pill, 'Backend: no verificado', 'warn');
  }
}
