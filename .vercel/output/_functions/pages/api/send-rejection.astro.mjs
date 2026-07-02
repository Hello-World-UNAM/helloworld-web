import { Resend } from 'resend';
export { renderers } from '../../renderers.mjs';

const resend = new Resend("re_jiyM7W2M_PyFaHgFwE2PKhycCM1CnDAzd");
const POST = async ({ request }) => {
  try {
    const body = await request.json();
    const { miembroEmail, miembroNombre, accion, notasAdmin, puntosSolicitados } = body;
    if (!miembroEmail || !notasAdmin) {
      return new Response(JSON.stringify({ error: "Faltan datos obligatorios" }), { status: 400 });
    }
    const { data, error } = await resend.emails.send({
      from: "Club Hello World <contacto@helloworld-unam.tech>",
      to: [miembroEmail],
      cc: ["contacto@helloworld-unam.tech"],
      subject: `Actualización sobre tu solicitud de puntos: ${accion}`,
      html: `
        <div style="background-color: #f5f3ff; padding: 3rem 1rem; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333;">
          <div style="text-align: center; margin-bottom: 2rem;">
            <div style="display: inline-block; border: 3px solid #000; padding: 0.5rem; background: #fff;">
              <img src="https://helloworld-unam.tech/img/favicon.png" width="48" height="48" alt="Hello World" style="display: block;" />
            </div>
          </div>
          <div style="max-width: 600px; margin: 0 auto; background: #fff; border: 3px solid #000; padding: 3rem 2.5rem;">
            <div style="display: inline-block; background: #fef08a; border: 2px solid #000; padding: 0.3rem 0.6rem; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2rem;">
              ✦ REVISIÓN DE EVIDENCIA
            </div>
            <h1 style="color: #000; margin: 0 0 1.5rem 0; font-size: 2.2rem; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">
              HOLA, ${miembroNombre.split(" ")[0]}.
            </h1>
            <p style="font-size: 1.05rem; line-height: 1.6; margin-bottom: 1.5rem;">
              Hemos revisado tu solicitud de evidencia para la acción <strong>"${accion}"</strong> (${puntosSolicitados} pts).
            </p>
            <p style="font-size: 1.05rem; line-height: 1.6; margin-bottom: 1.5rem;">
              Lamentamos informarte que tu evidencia <strong>no pudo ser aprobada</strong> en esta ocasión. La decisión no refleja una valoración negativa, simplemente hubo algún detalle técnico o faltante con el archivo proporcionado.
            </p>
            <p style="font-size: 1.05rem; line-height: 1.6; margin-bottom: 2rem;">
              Te invitamos a corregir la evidencia y subirla nuevamente en tu panel de miembro, o responder a este correo si tienes dudas adicionales.
            </p>
            <div style="background: #f3e8ff; border: 2px solid #000; padding: 1.5rem; margin-bottom: 3rem;">
              <p style="margin: 0 0 0.5rem 0; font-size: 0.85rem; font-weight: 800; text-transform: uppercase; color: #6225e6; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
                ✦ Notas de la Mesa Directiva
              </p>
              <p style="margin: 0; font-family: Georgia, serif; font-style: italic; font-size: 1.1rem; line-height: 1.6; color: #444;">
                "${notasAdmin}"
              </p>
            </div>
            <div style="color: #6225e6; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 1rem;">
              MANTENTE CERCA
            </div>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="31%" align="center" style="border: 2px solid #000; padding: 1.5rem 0;">
                  <a href="https://instagram.com/helloworld_unam" style="text-decoration: none;">
                    <div style="color: #6225e6; font-size: 0.65rem; font-weight: 800; text-transform: uppercase; margin-bottom: 0.3rem;">Instagram</div>
                    <div style="color: #000; font-size: 0.75rem; font-weight: 700;">@helloworld_unam</div>
                  </a>
                </td>
                <td width="3%"></td>
                <td width="32%" align="center" style="border: 2px solid #000; padding: 1.5rem 0;">
                  <a href="https://linkedin.com/company/hello-world-unam" style="text-decoration: none;">
                    <div style="color: #6225e6; font-size: 0.65rem; font-weight: 800; text-transform: uppercase; margin-bottom: 0.3rem;">LinkedIn</div>
                    <div style="color: #000; font-size: 0.75rem; font-weight: 700;">Hello World UNAM</div>
                  </a>
                </td>
                <td width="3%"></td>
                <td width="31%" align="center" style="border: 2px solid #000; padding: 1.5rem 0;">
                  <a href="https://github.com/Hello-World-UNAM" style="text-decoration: none;">
                    <div style="color: #6225e6; font-size: 0.65rem; font-weight: 800; text-transform: uppercase; margin-bottom: 0.3rem;">GitHub</div>
                    <div style="color: #000; font-size: 0.75rem; font-weight: 700;">Hello-World-UNAM</div>
                  </a>
                </td>
              </tr>
            </table>
          </div>
        </div>
      `
    });
    if (error) {
      return new Response(JSON.stringify({ error }), { status: 500 });
    }
    return new Response(JSON.stringify({ success: true, data }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  POST
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
