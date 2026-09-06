const SITE_URL = 'https://helloworld-unam.tech';

export interface SelectionHtmlTemplate {
  subject: string;
  html: string;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function firstName(fullName: string): string {
  return escapeHtml(fullName.split(' ')[0] || fullName);
}

function emailShell(options: { eyebrow: string; eyebrowBg: string; inner: string; title?: string }): string {
  const titleTag = options.title ? `<title>${escapeHtml(options.title)}</title>` : '';
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
          <div style="display:inline-block;background:${options.eyebrowBg};border:3px solid #000000;padding:6px 14px;font-weight:800;text-transform:uppercase;font-size:13px;letter-spacing:1.2px;color:#000000;margin-bottom:28px;">
            ${options.eyebrow}
          </div>
          ${options.inner}
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
  const networks = [
    {
      label: 'Instagram',
      handle: '@helloworld_unam',
      href: 'https://www.instagram.com/helloworld_unam/',
    },
    {
      label: 'LinkedIn',
      handle: 'Hello World UNAM',
      href: 'https://www.linkedin.com/in/hello-world-5243573b5/',
    },
    {
      label: 'GitHub',
      handle: 'Hello-World-UNAM',
      href: 'https://github.com/Hello-World-UNAM',
    },
  ];
  const cells = networks
    .map(
      (network) => `
    <td valign="top" width="33.33%" style="padding:4px;">
      <a href="${network.href}" style="display:block;background:#ffffff;border:3px solid #000000;padding:14px 10px;text-decoration:none;color:#000000;text-align:center;">
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;color:#6225e6;margin-bottom:4px;">${network.label}</div>
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:13px;font-weight:600;color:#222222;">${network.handle}</div>
      </a>
    </td>`,
    )
    .join('');
  return `
    <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:13px;font-weight:700;color:#6225e6;text-transform:uppercase;letter-spacing:1.2px;margin:32px 0 12px 0;">Mantente cerca</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px;"><tr>${cells}</tr></table>`;
}

export function legacyReceiptTemplate(nombre: string, seasonValue: string): SelectionHtmlTemplate {
  const name = firstName(nombre);
  const season = escapeHtml(seasonValue);
  return {
    subject: `Tu solicitud al Club Hello World — ${seasonValue}`,
    html: `<!DOCTYPE html>
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
            Hola, ${name}.
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
</html>`,
  };
}

export function legacyInitialAcceptedTemplate(nombre: string, deadlineSpanish: string, bookingUrlValue: string): SelectionHtmlTemplate {
  const name = firstName(nombre);
  const bookingUrl = escapeHtml(bookingUrlValue);
  return {
    subject: 'Avanzaste a la siguiente fase — Club Hello World',
    html: emailShell({
      eyebrow: '✓ Avanzaste a la siguiente fase',
      eyebrowBg: '#d1fae5',
      title: 'Avanzaste a la siguiente fase — Club Hello World',
      inner: `
      <h1 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:30px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 22px 0;color:#000000;line-height:1.1;">
        ${name}, queremos conocerte.
      </h1>
      <p style="font-size:16px;line-height:1.75;color:#333333;margin:0 0 18px 0;">
        Tu solicitud nos convenció. Lo que escribiste resonó con nosotros: vimos a alguien que vale la pena conocer en persona.
      </p>
      <p style="font-size:16px;line-height:1.75;color:#333333;margin:0 0 28px 0;">
        El siguiente paso es una entrevista corta con un par de personas del equipo. Queremos entender quién hay detrás de la solicitud y resolverte dudas que tengas sobre el club.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0e6ff;border:4px solid #000000;margin:0 0 28px 0;">
        <tr><td style="padding:28px 24px;text-align:center;">
          <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:13px;font-weight:800;color:#6225e6;text-transform:uppercase;letter-spacing:2px;margin:0 0 8px 0;">
            ★ Agenda tu entrevista
          </p>
          <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;color:#444;margin:0 0 22px 0;line-height:1.5;">
            Por Google Meet<br>
            Tú eliges el horario que mejor te quede.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto 18px;">
            <tr><td bgcolor="#6225e6" style="background:#6225e6;border:3px solid #000000;">
              <a href="${bookingUrl}" style="display:inline-block;padding:14px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;font-weight:800;text-transform:uppercase;letter-spacing:1.2px;color:#ffffff;text-decoration:none;">
                Reservar horario →
              </a>
            </td></tr>
          </table>
          <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:13px;color:#666;margin:0;line-height:1.4;">
            ⏰ Tienes hasta el <strong style="color:#6225e6;">${escapeHtml(deadlineSpanish)}</strong> para agendar.
          </p>
        </td></tr>
      </table>
      <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:13px;font-weight:800;color:#6225e6;text-transform:uppercase;letter-spacing:1.2px;margin:0 0 10px 0;">
        Qué esperar
      </p>
      <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 14px 0;">
        Es una conversación corta con un par de personas del equipo. Queremos entender quién hay detrás de la solicitud y resolverte dudas que tengas sobre el club.
      </p>
      <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 28px 0;">
        No hay nada que preparar — lo que ya hiciste hasta hoy es suficiente.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0e6ff;border:3px solid #000000;margin:0 0 8px 0;">
        <tr><td style="padding:22px 24px;">
          <p style="font-family:Georgia,'Times New Roman',serif;font-style:italic;font-size:16px;color:#2d002e;margin:0;line-height:1.55;">
            “El formulario nos dijo lo que has hecho. La entrevista nos dirá quién eres.”
          </p>
        </td></tr>
      </table>
      ${socialBlock()}
    `,
    }),
  };
}

export function legacyInitialRejectedTemplate(nombre: string, seasonValue: string): SelectionHtmlTemplate {
  const name = firstName(nombre);
  const season = escapeHtml(seasonValue);
  return {
    subject: 'Sobre tu solicitud al Club Hello World',
    html: emailShell({
      eyebrow: `✦ Decisión final · ${season}`,
      eyebrowBg: '#fef3c7',
      title: 'Sobre tu solicitud al Club Hello World',
      inner: `
      <h1 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:30px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 22px 0;color:#000000;line-height:1.1;">
        Hola, ${name}.
      </h1>
      <p style="font-size:16px;line-height:1.75;color:#333333;margin:0 0 18px 0;">
        Gracias por aplicar al Club Hello World. Tu solicitud fue revisada con detenimiento por miembros del equipo — no por un algoritmo.
      </p>
      <p style="font-size:16px;line-height:1.75;color:#333333;margin:0 0 18px 0;">
        Lamentamos informarte que en esta temporada no pudimos avanzar con tu candidatura. La decisión no refleja una valoración de tu potencial; el proceso fue altamente competitivo y los espacios limitados.
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
    }),
  };
}

export function legacyBookingTemplate(options: {
  nombre: string;
  dateLong: string;
  time: string;
  durationMinutes: number;
  meetUrl: string;
  manageUrl: string;
}): SelectionHtmlTemplate {
  const name = firstName(options.nombre);
  const dateLong = escapeHtml(options.dateLong);
  const time = escapeHtml(options.time);
  const meetUrl = escapeHtml(options.meetUrl);
  const manageUrl = escapeHtml(options.manageUrl);
  return {
    subject: `Confirmada: tu entrevista el ${options.dateLong}`,
    html: `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only"><title>Confirmada: tu entrevista</title><style>:root{color-scheme:light only;supported-color-schemes:light only;}[data-ogsc] body,[data-ogsb] body{background:#faf8ff !important;}</style></head><body style="margin:0;padding:24px 16px;background:#faf8ff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#222;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center">

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;"><tr><td style="background:#fff;border:4px solid #000;padding:12px;line-height:0;"><a href="${SITE_URL}" style="text-decoration:none;display:block;line-height:0;"><img src="${SITE_URL}/img/logo.png" alt="Club Hello World" width="52" height="52" style="display:block;width:52px;height:52px;"></a></td></tr></table>

  <table role="presentation" width="580" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;width:100%;background:#fff;border:4px solid #000;"><tr><td style="padding:36px 32px;">

    <div style="display:inline-block;background:#d1fae5;border:3px solid #000;padding:6px 14px;font-weight:800;text-transform:uppercase;font-size:13px;letter-spacing:1.2px;color:#000;margin-bottom:28px;">✓ Entrevista confirmada</div>

    <h1 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:30px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 22px 0;color:#000;line-height:1.1;">Listo, ${name}.</h1>

    <p style="font-size:16px;line-height:1.75;color:#333;margin:0 0 28px 0;">Tu entrevista con el equipo del Club Hello World está confirmada.</p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0e6ff;border:4px solid #000;margin:0 0 28px 0;"><tr><td style="padding:24px 22px;">
      <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:12px;font-weight:800;color:#6225e6;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px 0;">Cuándo</p>
      <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:18px;font-weight:900;color:#000;margin:0 0 6px 0;line-height:1.3;">${dateLong}</p>
      <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:16px;color:#333;margin:0 0 18px 0;">${time} hrs · ${options.durationMinutes} minutos</p>

      <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:12px;font-weight:800;color:#6225e6;text-transform:uppercase;letter-spacing:2px;margin:18px 0 8px 0;">Dónde</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#6225e6" style="background:#6225e6;border:3px solid #000;"><a href="${meetUrl}" style="display:inline-block;padding:12px 22px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#fff;text-decoration:none;"><span style="display:inline-block;vertical-align:middle;margin-right:4px;">📹</span> Abrir Google Meet</a></td></tr></table>
      <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:11px;color:#777;margin:10px 0 0;word-break:break-all;">${meetUrl}</p>
    </td></tr></table>

    <p style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:13px;font-weight:800;color:#6225e6;text-transform:uppercase;letter-spacing:1.2px;margin:0 0 10px 0;">Antes de tu entrevista</p>
    <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 8px 0;">• Llega 1 minuto antes y verifica tu cámara y micrófono.</p>
    <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 8px 0;">• Si surge algo, escríbenos con al menos <strong>12 h</strong> de anticipación.</p>
    <p style="font-size:15px;line-height:1.7;color:#444;margin:0 0 24px 0;">• Llega tú — nada que preparar.</p>

    <p style="font-size:14px;line-height:1.6;color:#666;margin:24px 0 0;">¿Necesitas cambiar de horario? <a href="${manageUrl}" style="color:#6225e6;text-decoration:none;font-weight:700;">Gestiona tu entrevista aquí.</a></p>

  </td></tr></table>

  <table role="presentation" width="580" cellpadding="0" cellspacing="0" border="0" style="max-width:580px;width:100%;margin-top:28px;"><tr><td align="center" style="padding:0 16px;"><p style="font-size:12px;color:#777;margin:0 0 4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">Club Hello World · FES Aragón, UNAM</p><p style="font-size:12px;color:#999;margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">Si tienes dudas, responde a este correo.</p></td></tr></table>

</td></tr></table></body></html>`,
  };
}

export function legacyFinalAcceptedTemplate(nombre: string, seasonValue: string, whatsappUrlValue: string): SelectionHtmlTemplate {
  const name = firstName(nombre);
  const season = escapeHtml(seasonValue);
  const whatsappUrl = escapeHtml(whatsappUrlValue);
  return {
    subject: '¡Bienvenida/o al Club Hello World!',
    html: emailShell({
      eyebrow: '✓ ¡Bienvenida/o oficial!',
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
              <a href="${whatsappUrl}" style="display:inline-block;padding:14px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:15px;font-weight:800;text-transform:uppercase;letter-spacing:1.2px;color:#ffffff;text-decoration:none;">
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
    }),
  };
}

export function legacyFinalRejectedTemplate(nombre: string, seasonValue: string): SelectionHtmlTemplate {
  const name = firstName(nombre);
  const season = escapeHtml(seasonValue);
  return {
    subject: 'Sobre tu proceso de selección — Club Hello World',
    html: emailShell({
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
    }),
  };
}

export function noShowFinalRejectedTemplate(nombre: string, seasonValue: string): SelectionHtmlTemplate {
  const name = firstName(nombre);
  const season = escapeHtml(seasonValue);
  return {
    subject: 'Sobre tu proceso de selección — Club Hello World',
    html: emailShell({
      eyebrow: `✦ Proceso de selección · ${season}`,
      eyebrowBg: '#fef3c7',
      title: 'Sobre tu proceso de selección — Club Hello World',
      inner: `
      <h1 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:30px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 22px 0;color:#000000;line-height:1.1;">
        Hola, ${name}.
      </h1>
      <p style="font-size:16px;line-height:1.75;color:#333333;margin:0 0 18px 0;">
        No registramos tu asistencia a la entrevista que habías agendado con el equipo del Club Hello World.
      </p>
      <p style="font-size:16px;line-height:1.75;color:#333333;margin:0 0 18px 0;">
        Como esa conversación forma parte indispensable del proceso, en esta temporada no podremos continuar con tu candidatura.
      </p>
      <p style="font-size:16px;line-height:1.75;color:#333333;margin:0 0 28px 0;">
        Si ocurrió un problema o crees que recibiste este mensaje por error, responde a este correo para que podamos revisar tu caso.
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
    }),
  };
}

export function neutralFinalAcceptedTemplate(nombre: string, seasonValue: string, whatsappUrlValue: string): SelectionHtmlTemplate {
  const name = firstName(nombre);
  const season = escapeHtml(seasonValue);
  const whatsappUrl = escapeHtml(whatsappUrlValue);
  const subject = `Resultado de tu proceso · ${seasonValue}`;
  return {
    subject,
    html: emailShell({
      eyebrow: `✓ Decisión final · ${season}`,
      eyebrowBg: '#d1fae5',
      title: subject,
      inner: `
      <h1 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:30px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 22px 0;color:#000000;line-height:1.1;">Hola, ${name}.</h1>
      <p style="font-size:16px;line-height:1.75;color:#333333;margin:0 0 18px 0;">Nos da mucho gusto informarte que fuiste admitido(a) al Club Hello World para la temporada ${season}.</p>
      <p style="font-size:16px;line-height:1.75;color:#333333;margin:0 0 24px 0;">¡Bienvenido(a) al Club Hello World!</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#d1fae5;border:4px solid #000000;margin:0 0 8px 0;"><tr><td style="padding:28px 24px;text-align:center;">
        <p style="font-size:15px;color:#065f46;margin:0 0 22px 0;line-height:1.5;">Para recibir indicaciones y mantenerte en contacto con el equipo, únete al grupo de WhatsApp.</p>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td bgcolor="#25D366" style="background:#25D366;border:3px solid #000000;"><a href="${whatsappUrl}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:800;text-transform:uppercase;letter-spacing:1.2px;color:#ffffff;text-decoration:none;">Entrar al WhatsApp →</a></td></tr></table>
      </td></tr></table>
      ${socialBlock()}
    `,
    }),
  };
}

export function neutralFinalRejectedTemplate(nombre: string, seasonValue: string): SelectionHtmlTemplate {
  const name = firstName(nombre);
  const season = escapeHtml(seasonValue);
  const subject = `Resultado de tu proceso · ${seasonValue}`;
  return {
    subject,
    html: emailShell({
      eyebrow: `✦ Decisión final · ${season}`,
      eyebrowBg: '#fef3c7',
      title: subject,
      inner: `
      <h1 style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:30px;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 22px 0;color:#000000;line-height:1.1;">Hola, ${name}.</h1>
      <p style="font-size:16px;line-height:1.75;color:#333333;margin:0 0 18px 0;">Después de concluir la revisión de tu proceso para la temporada ${season}, por esta ocasión no fuiste admitido(a) al Club Hello World.</p>
      <p style="font-size:16px;line-height:1.75;color:#333333;margin:0 0 28px 0;">Agradecemos sinceramente tu interés y el tiempo que dedicaste a participar.</p>
      ${socialBlock()}
    `,
    }),
  };
}
