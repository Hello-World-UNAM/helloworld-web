import { legacyMailAllowed } from "../_shared/legacy-mail-guard.ts";
import "jsr:@supabase/functions-js@2.115.0/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.105.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const FROM_EMAIL = "Club Hello World <contacto@helloworld-unam.tech>";
const REPLY_TO = "contacto@helloworld-unam.tech";
const SITE_URL = "https://helloworld-unam.tech";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SEASON_REGEX = /^\d{4}-([12]|\d{4})$/;

type Solicitud = {
  id: string;
  nombre: string;
  correo: string;
  season: string;
  final_decision: "accepted" | "rejected";
};

Deno.serve(async (req: Request) => {
  if (req.method !== "OPTIONS" && !(await legacyMailAllowed())) {
    return new Response(JSON.stringify({ error: "LEGACY_DISABLED_RELOAD", message: "Usa el panel actualizado de Selecciones." }), { status: 409, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  }

  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });

  let body: { season?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const season = body.season?.trim();
  if (!season || !SEASON_REGEX.test(season)) {
    return json({ error: `Invalid or missing 'season'` }, 400);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing Authorization header" }, 401);
  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user } } = await callerClient.auth.getUser();
  if (!user?.email) return json({ error: "Unauthenticated" }, 401);
  const { data: directiva } = await callerClient
    .from("directiva").select("email").eq("email", user.email.toLowerCase()).maybeSingle();
  if (!directiva) return json({ error: "Forbidden: not in directiva" }, 403);

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Leer config para whatsapp_url
  const { data: cfg, error: cfgErr } = await adminClient
    .from("seleccion_config")
    .select("whatsapp_url")
    .eq("id", true)
    .maybeSingle();
  if (cfgErr) return json({ error: `Config fetch failed: ${cfgErr.message}` }, 500);
  const whatsappUrl = cfg?.whatsapp_url || "";
  if (!whatsappUrl) {
    return json({ error: "Falta configurar el URL del grupo de WhatsApp en el panel." }, 400);
  }

  // Solicitudes con final_decision pero sin notificar todavía
  const { data: rows, error: fetchErr } = await adminClient
    .from("solicitudes")
    .select("id, nombre, correo, season, final_decision")
    .eq("season", season)
    .eq("status", "accepted")
    .in("final_decision", ["accepted", "rejected"])
    .eq("final_email_sent", false);
  if (fetchErr) return json({ error: `Fetch failed: ${fetchErr.message}` }, 500);
  if (!rows || rows.length === 0) {
    return json({ ok: true, sent: 0, failed: 0, message: "No hay correos finales pendientes." });
  }

  let sent = 0;
  let failed = 0;
  const errors: Array<{ id: string; correo: string; error: string }> = [];

  for (const row of rows as Solicitud[]) {
    const html = row.final_decision === "accepted"
      ? buildWelcomeEmail(row, whatsappUrl)
      : buildFarewellEmail(row);
    const subject = row.final_decision === "accepted"
      ? `¡Bienvenida/o al Club Hello World!`
      : `Sobre tu proceso de selección — Club Hello World`;

    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify({ from: FROM_EMAIL, to: [row.correo], reply_to: REPLY_TO, subject, html }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Resend ${res.status}: ${txt}`);
      }
      const { error: upErr } = await adminClient
        .from("solicitudes")
        .update({ final_email_sent: true })
        .eq("id", row.id);
      if (upErr) throw new Error(`DB update failed: ${upErr.message}`);
      sent++;
    } catch (e) {
      failed++;
      errors.push({
        id: row.id, correo: row.correo,
        error: e instanceof Error ? e.message : String(e),
      });
      console.error("Bulk final failure:", row.id, row.correo, e);
    }
    await sleep(600);
  }

  return json({ ok: true, sent, failed, total: rows.length, errors: errors.slice(0, 10) });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)); }
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function firstName(full: string): string {
  return escapeHtml(full.split(" ")[0] || full);
}

function emailShell(opts: { eyebrow: string; eyebrowBg: string; inner: string; title?: string }): string {
  const titleTag = opts.title ? `<title>${escapeHtml(opts.title)}</title>` : '';
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light only">
  <meta name="supported-color-schemes" content="light only">
  ${titleTag}
  <style>
    :root { color-scheme: light only; supported-color-schemes: light only; }
    [data-ogsc] body, [data-ogsb] body { background:#faf8ff !important; }
  </style>
</head>
<body style="margin:0;padding:24px 16px;background:#faf8ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#222;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;">
        <tr><td style="background:#ffffff;border:4px solid #000000;padding:12px;line-height:0;">
          <a href="${SITE_URL}" style="text-decoration:none;display:block;line-height:0;">
            <img src="${SITE_URL}/img/logo.png" alt="Club Hello World" width="52" height="52" style="display:block;width:52px;height:52px;">
          </a>
        </td></tr>
      </table>
      <table role="presentation" width="580" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;width:100%;background:#ffffff;border:4px solid #000000;">
        <tr><td style="padding:36px 32px;">
          <div style="display:inline-block;background:${opts.eyebrowBg};border:3px solid #000000;padding:6px 14px;font-weight:800;text-transform:uppercase;font-size:13px;letter-spacing:1.2px;color:#000000;margin-bottom:28px;">
            ${opts.eyebrow}
          </div>
          ${opts.inner}
        </td></tr>
      </table>
      <table role="presentation" width="580" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;width:100%;margin-top:28px;">
        <tr><td align="center" style="padding:0 16px;">
          <p style="font-size:12px;color:#777777;margin:0 0 4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">Club Hello World · FES Aragón, UNAM</p>
          <p style="font-size:12px;color:#999999;margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">Si tienes dudas, responde a este correo.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function socialBlock(): string {
  const redes = [
    { label: 'Instagram', handle: '@helloworld_unam', href: 'https://www.instagram.com/helloworld_unam/' },
    { label: 'LinkedIn',  handle: 'Hello World UNAM', href: 'https://www.linkedin.com/in/hello-world-5243573b5/' },
    { label: 'GitHub',    handle: 'Hello-World-UNAM', href: 'https://github.com/Hello-World-UNAM' },
  ];
  const cells = redes.map(r => `
    <td valign="top" width="33.33%" style="padding:4px;">
      <a href="${r.href}" style="display:block;background:#ffffff;border:3px solid #000000;padding:14px 10px;text-decoration:none;color:#000000;text-align:center;">
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:#6225e6;margin-bottom:4px;">${r.label}</div>
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:13px;font-weight:600;color:#222222;">${r.handle}</div>
      </a>
    </td>`).join('');
  return `
    <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:13px;font-weight:700;color:#6225e6;text-transform:uppercase;letter-spacing:1.2px;margin:32px 0 12px 0;">Mantente cerca</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;"><tr>${cells}</tr></table>`;
}

function buildWelcomeEmail(r: Solicitud, whatsappUrl: string): string {
  const name = firstName(r.nombre);
  const season = escapeHtml(r.season);
  const wa = escapeHtml(whatsappUrl);
  return emailShell({
    eyebrow: `✓ ¡Bienvenida/o oficial!`,
    eyebrowBg: '#d1fae5',
    title: '¡Bienvenida/o al Club Hello World!',
    inner: `
      <h1 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:32px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 18px 0;color:#000000;line-height:1.05;">
        Estás dentro, ${name}.
      </h1>
      <p style="font-size:17px;line-height:1.7;color:#222222;margin:0 0 18px 0;font-weight:600;">
        Después del formulario, la entrevista y la deliberación del equipo, quedó claro: te queremos en el Club Hello World, temporada ${season}.
      </p>
      <p style="font-size:16px;line-height:1.7;color:#333333;margin:0 0 18px 0;">
        Lo que escribiste y lo que conversamos contigo nos convenció — ahora sí eres parte de esta generación.
      </p>
      <p style="font-size:16px;line-height:1.7;color:#333333;margin:0 0 28px 0;">
        El primer paso para sumarte es entrar al grupo de WhatsApp del club. Ahí coordinamos todo: reuniones, eventos, proyectos, hackatones.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#d1fae5;border:4px solid #000000;margin:0 0 28px 0;">
        <tr><td style="padding:28px 24px;text-align:center;">
          <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:13px;font-weight:800;color:#065f46;text-transform:uppercase;letter-spacing:2px;margin:0 0 8px 0;">
            ★ Únete al grupo
          </p>
          <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;color:#065f46;margin:0 0 22px 0;line-height:1.5;">
            Ahí está el equipo y los siguientes pasos.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
            <tr><td bgcolor="#25D366" style="background:#25D366;border:3px solid #000000;">
              <a href="${wa}" style="display:inline-block;padding:14px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;font-weight:800;text-transform:uppercase;letter-spacing:1.2px;color:#ffffff;text-decoration:none;">
                Entrar al WhatsApp →
              </a>
            </td></tr>
          </table>
        </td></tr>
      </table>
      <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:13px;font-weight:800;color:#6225e6;text-transform:uppercase;letter-spacing:1.2px;margin:0 0 10px 0;">
        Qué sigue
      </p>
      <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 14px 0;">
        En el grupo coordinaremos la primera reunión. Llegarán los detalles de cuando arrancamos y cómo nos organizamos.
      </p>
      <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 28px 0;">
        Bienvenida/o oficialmente. A construir, competir y dejar huella.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0e6ff;border:3px solid #000000;margin:0 0 8px 0;">
        <tr><td style="padding:22px 24px;">
          <p style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:17px;color:#2d002e;margin:0;line-height:1.55;">
            “Ahora sí empieza lo bueno. Nos vemos adentro.”
          </p>
        </td></tr>
      </table>
      ${socialBlock()}
    `,
  });
}

function buildFarewellEmail(r: Solicitud): string {
  const name = firstName(r.nombre);
  const season = escapeHtml(r.season);
  return emailShell({
    eyebrow: `✦ Decisión final · ${season}`,
    eyebrowBg: '#fef3c7',
    title: 'Sobre tu proceso de selección — Club Hello World',
    inner: `
      <h1 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:30px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 22px 0;color:#000000;line-height:1.1;">
        Gracias, ${name}.
      </h1>
      <p style="font-size:16px;line-height:1.75;color:#333333;margin:0 0 18px 0;">
        Llegaste hasta la entrevista, y eso ya te separa de la mayoría. Gracias por tomarte el tiempo de aplicar, agendar y conversar con nosotros.
      </p>
      <p style="font-size:16px;line-height:1.75;color:#333333;margin:0 0 18px 0;">
        Lamentamos informarte que tras la evaluación del equipo, en esta temporada no pudimos avanzar con tu candidatura. La decisión no refleja una valoración de tu potencial; el proceso fue altamente competitivo y los espacios limitados.
      </p>
      <p style="font-size:16px;line-height:1.75;color:#333333;margin:0 0 28px 0;">
        Te invitamos a postularte nuevamente en la próxima convocatoria. Mientras tanto, te animamos a seguir construyendo y aprendiendo — el crecimiento técnico es un camino que recorres con nosotros o sin nosotros.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0e6ff;border:3px solid #000000;margin:0 0 8px 0;">
        <tr><td style="padding:22px 24px;">
          <p style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:16px;color:#2d002e;margin:0;line-height:1.55;">
            “El club no es la única forma de desarrollarse y seguir creciendo. Es solo una de miles.”
          </p>
        </td></tr>
      </table>
      ${socialBlock()}
    `,
  });
}
