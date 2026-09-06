import { legacyMailAllowed } from "../_shared/legacy-mail-guard.ts";
import "jsr:@supabase/functions-js@2.115.0/edge-runtime.d.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = "Club Hello World <contacto@helloworld-unam.tech>";
const REPLY_TO = "contacto@helloworld-unam.tech";

type WebhookPayload = {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: {
    id: string;
    nombre: string;
    correo: string;
    season: string;
  } | null;
  old_record: unknown;
};

Deno.serve(async (req: Request) => {
  if (req.method !== "OPTIONS" && !(await legacyMailAllowed())) {
    return new Response(JSON.stringify({ error: "LEGACY_DISABLED_RELOAD", message: "Usa el panel actualizado de Selecciones." }), { status: 409, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  if (!RESEND_API_KEY) {
    console.error("RESEND_API_KEY missing in env");
    return new Response("Server misconfigured", { status: 500 });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (payload.type !== "INSERT" || payload.table !== "solicitudes" || !payload.record) {
    return new Response(JSON.stringify({ ok: true, ignored: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { record } = payload;
  if (!record.correo || !record.nombre || !record.season) {
    return new Response("Missing fields in record", { status: 400 });
  }

  const html = buildEmailHtml(record);
  const subject = `Tu solicitud al Club Hello World — ${record.season}`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [record.correo],
      reply_to: REPLY_TO,
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Resend failed:", res.status, err);
    return new Response(JSON.stringify({ ok: false, error: err }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  const data = await res.json();
  console.log("Sent confirmation:", record.correo, data.id);

  return new Response(JSON.stringify({ ok: true, email_id: data.id }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildEmailHtml(r: { nombre: string; season: string }): string {
  const firstName = escapeHtml(r.nombre.split(" ")[0] || r.nombre);
  const season = escapeHtml(r.season);
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Solicitud recibida</title>
</head>
<body style="margin:0;padding:24px 16px;background:#f9f3ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#222;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr><td align="center">
      <table role="presentation" width="580" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;background:#ffffff;border:4px solid #000000;">
        <tr><td style="padding:40px 36px 36px 36px;">
          <div style="display:inline-block;background:#c4b5fd;border:3px solid #000;padding:6px 14px;font-weight:800;text-transform:uppercase;font-size:13px;letter-spacing:1px;color:#000;margin-bottom:28px;">
            ✦ Solicitud recibida · ${season}
          </div>
          <h1 style="font-size:30px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 18px 0;color:#000;line-height:1.1;">
            Hola, ${firstName}.
          </h1>
          <p style="font-size:16px;line-height:1.7;color:#333;margin:0 0 18px 0;">
            Recibimos tu solicitud al <strong>Club Hello World</strong>. Está oficialmente en nuestras manos.
          </p>
          <p style="font-size:16px;line-height:1.7;color:#333;margin:0 0 18px 0;">
            Cada solicitud la lee alguien del equipo — no un algoritmo. Tomamos lo que escribiste en serio y lo revisaremos con calma.
          </p>
          <p style="font-size:16px;line-height:1.7;color:#333;margin:0 0 32px 0;">
            Te escribiremos a este correo cuando tengamos una decisión, sin importar cuál sea.
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0e6ff;border:3px solid #000;margin:0 0 32px 0;">
            <tr><td style="padding:22px 24px;">
              <p style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:17px;color:#2d002e;margin:0;line-height:1.55;">
                “No buscamos el promedio más alto. Buscamos a quien quiera competir, construir cosas reales y dejar huella desde la UNAM.”
              </p>
            </td></tr>
          </table>
          <p style="font-size:14px;color:#666;line-height:1.6;margin:0 0 8px 0;">
            Mientras tanto, si quieres ver qué hacemos en el día a día:
          </p>
          <p style="font-size:15px;color:#6225e6;line-height:1.6;margin:0 0 32px 0;font-weight:700;">
            <a href="https://www.instagram.com/helloworld_unam/" style="color:#6225e6;text-decoration:none;">@helloworld_unam</a>
          </p>
          <hr style="border:0;border-top:2px solid #000;margin:32px 0 20px 0;">
          <p style="font-size:12px;color:#888;margin:0;text-align:center;line-height:1.6;">
            Club Hello World · FES Aragón, UNAM<br>
            Si tienes dudas, responde a este correo.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
