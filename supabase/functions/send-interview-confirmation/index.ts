import { legacyMailAllowed } from "../_shared/legacy-mail-guard.ts";
import "jsr:@supabase/functions-js@2.115.0/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.105.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = "Club Hello World <contacto@helloworld-unam.tech>";
const REPLY_TO = "contacto@helloworld-unam.tech";
const SITE_URL = "https://helloworld-unam.tech";

type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: {
    id: string;
    solicitud_id: string;
    slot_datetime: string;
    duration_minutes: number;
    meet_url: string | null;
    status: string;
    email_sent: boolean;
  } | null;
  old_record: unknown;
};

Deno.serve(async (req: Request) => {
  if (req.method !== "OPTIONS" && !(await legacyMailAllowed())) {
    return new Response(JSON.stringify({ error: "LEGACY_DISABLED_RELOAD", message: "Usa el panel actualizado de Selecciones." }), { status: 409, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  }

  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let payload: WebhookPayload;
  try { payload = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }

  if (payload.table !== "interviews" || !payload.record) {
    return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200 });
  }

  const rec = payload.record;

  // Solo procesar INSERTs de status=confirmed
  if (payload.type !== "INSERT" || rec.status !== "confirmed") {
    return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200 });
  }
  if (rec.email_sent) {
    return new Response(JSON.stringify({ ok: true, already_sent: true }), { status: 200 });
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Cargar solicitud + token (para link de reagendar)
  const { data: sol, error: solErr } = await adminClient
    .from("solicitudes")
    .select("id, nombre, correo, season")
    .eq("id", rec.solicitud_id)
    .maybeSingle();
  if (solErr || !sol) {
    console.error("Solicitud not found:", rec.solicitud_id, solErr);
    return new Response(JSON.stringify({ ok: false, error: "solicitud_not_found" }), { status: 404 });
  }

  const { data: tokenRow } = await adminClient
    .from("interview_booking_tokens")
    .select("token")
    .eq("solicitud_id", rec.solicitud_id)
    .maybeSingle();
  const manageUrl = tokenRow ? `${SITE_URL}/seleccion/agendar?t=${tokenRow.token}` : `${SITE_URL}/seleccion`;

  const slotDate = new Date(rec.slot_datetime);
  const dateLong = formatDateLong(slotDate);
  const timeStr = formatTime(slotDate);
  const subject = `Confirmada: tu entrevista el ${dateLong}`;

  const html = buildEmail({
    name: firstName(sol.nombre),
    dateLong,
    time: timeStr,
    durationMinutes: rec.duration_minutes,
    meetUrl: rec.meet_url || '',
    manageUrl,
  });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({ from: FROM_EMAIL, to: [sol.correo], reply_to: REPLY_TO, subject, html }),
  });
  if (!res.ok) {
    const txt = await res.text();
    console.error("Resend failed:", res.status, txt);
    return new Response(JSON.stringify({ ok: false, error: txt }), { status: 502 });
  }

  await adminClient.from("interviews").update({ email_sent: true }).eq("id", rec.id);

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
});

function firstName(full: string): string {
  return escapeHtml(full.split(" ")[0] || full);
}
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function formatDateLong(d: Date): string {
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'America/Mexico_City',
  }).format(d);
}
function formatTime(d: Date): string {
  return new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: 'America/Mexico_City',
  }).format(d);
}

function buildEmail(opts: { name: string; dateLong: string; time: string; durationMinutes: number; meetUrl: string; manageUrl: string }): string {
  const { name, dateLong, time, durationMinutes, meetUrl, manageUrl } = opts;
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only"><title>Confirmada: tu entrevista</title><style>:root{color-scheme:light only;supported-color-schemes:light only;}[data-ogsc] body,[data-ogsb] body{background:#faf8ff !important;}</style></head><body style="margin:0;padding:24px 16px;background:#faf8ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#222;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center">

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;"><tr><td style="background:#fff;border:4px solid #000;padding:12px;line-height:0;"><a href="${SITE_URL}" style="text-decoration:none;display:block;line-height:0;"><img src="${SITE_URL}/img/logo.png" alt="Club Hello World" width="52" height="52" style="display:block;width:52px;height:52px;"></a></td></tr></table>

  <table role="presentation" width="580" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;width:100%;background:#fff;border:4px solid #000;"><tr><td style="padding:36px 32px;">

    <div style="display:inline-block;background:#d1fae5;border:3px solid #000;padding:6px 14px;font-weight:800;text-transform:uppercase;font-size:13px;letter-spacing:1.2px;color:#000;margin-bottom:28px;">✓ Entrevista confirmada</div>

    <h1 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:30px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 22px 0;color:#000;line-height:1.1;">Listo, ${name}.</h1>

    <p style="font-size:16px;line-height:1.75;color:#333;margin:0 0 28px 0;">Tu entrevista con el equipo del Club Hello World está confirmada.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0e6ff;border:4px solid #000;margin:0 0 28px 0;"><tr><td style="padding:24px 22px;">
      <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:12px;font-weight:800;color:#6225e6;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px 0;">Cuándo</p>
      <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:18px;font-weight:900;color:#000;margin:0 0 6px 0;line-height:1.3;">${escapeHtml(dateLong)}</p>
      <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:16px;color:#333;margin:0 0 18px 0;">${escapeHtml(time)} hrs · ${durationMinutes} minutos</p>

      <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:12px;font-weight:800;color:#6225e6;text-transform:uppercase;letter-spacing:2px;margin:18px 0 8px 0;">Dónde</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#6225e6" style="background:#6225e6;border:3px solid #000;"><a href="${meetUrl}" style="display:inline-block;padding:12px 22px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#fff;text-decoration:none;"><span style="display:inline-block;vertical-align:middle;margin-right:4px;">📹</span> Abrir Google Meet</a></td></tr></table>
      <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:11px;color:#777;margin:10px 0 0;word-break:break-all;">${escapeHtml(meetUrl)}</p>
    </td></tr></table>

    <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:13px;font-weight:800;color:#6225e6;text-transform:uppercase;letter-spacing:1.2px;margin:0 0 10px 0;">Antes de tu entrevista</p>
    <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 8px 0;">• Llega 1 minuto antes y verifica tu cámara y micrófono.</p>
    <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 8px 0;">• Si surge algo, escríbenos con al menos <strong>12 h</strong> de anticipación.</p>
    <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 24px 0;">• Llega tú — nada que preparar.</p>

    <p style="font-size:14px;line-height:1.6;color:#666;margin:24px 0 0;">¿Necesitas cambiar de horario? <a href="${manageUrl}" style="color:#6225e6;text-decoration:none;font-weight:700;">Gestiona tu entrevista aquí.</a></p>

  </td></tr></table>

  <table role="presentation" width="580" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;width:100%;margin-top:28px;"><tr><td align="center" style="padding:0 16px;"><p style="font-size:12px;color:#777;margin:0 0 4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">Club Hello World · FES Aragón, UNAM</p><p style="font-size:12px;color:#999;margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">Si tienes dudas, responde a este correo.</p></td></tr></table>

</td></tr></table></body></html>`;
}
