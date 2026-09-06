const PRODUCTION_PROJECT_REF = 'hzewxtimkbxljozyrafk';

export const isSelectionLab = import.meta.env.PUBLIC_SELECTION_LAB === 'true';

export function assertSafeSupabaseEnvironment(rawUrl: string | undefined): void {
  if (!isSelectionLab) return;
  if (!rawUrl) throw new Error('Selection Lab requiere una URL local de Supabase.');

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Selection Lab recibió una URL de Supabase inválida.');
  }

  const isLoopback = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
  if (
    !isLoopback ||
    url.hostname.endsWith('.supabase.co') ||
    rawUrl.includes(PRODUCTION_PROJECT_REF)
  ) {
    throw new Error('Barrera de seguridad: Selection Lab se negó a usar Supabase remoto.');
  }
}
