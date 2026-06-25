import type { APIRoute } from 'astro';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(import.meta.env.RESEND_API_KEY);

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY
);

export const GET: APIRoute = async ({ request }) => {
  try {
    // 1. Basic Security: Check Authorization Header or query param
    const authHeader = request.headers.get('authorization');
    const url = new URL(request.url);
    const token = url.searchParams.get('token');
    
    const cronSecret = import.meta.env.CRON_SECRET;
    
    if (cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}` && token !== cronSecret) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
      }
    }

    // 2. Query Supabase for pending requests
    const { count, error: dbError } = await supabase
      .from('puntos_registros')
      .select('*', { count: 'exact', head: true })
      .eq('estado_aprobacion', 'pending');

    if (dbError) {
      throw new Error(dbError.message);
    }

    // 3. Early Exit if no pending requests (The "Smart" logic)
    if (!count || count === 0) {
      return new Response(JSON.stringify({ 
        message: "Operación abortada: No hay solicitudes pendientes por auditar.",
        count: 0
      }), { status: 200 });
    }

    // 4. Fetch dynamic CC list from miembros_activos (Mesa Directiva / Admins)
    const { data: admins } = await supabase
      .from('miembros_activos')
      .select('correo')
      .or('rol.eq.admin,cargo.eq.Mesa directiva');

    const adminEmails = admins?.map(a => a.correo).filter(Boolean) || [];
    
    // Also support fallback from env for emergencies
    const rawCcList = import.meta.env.DIRECTIVA_EMAILS || '';
    let ccArray = [...new Set([...adminEmails, ...rawCcList.split(',').map(e => e.trim()).filter(e => e.length > 0)])];
    
    if (ccArray.length === 0) {
      ccArray = ['mesadirectiva@helloworld-unam.tech']; // Fallback
    }

    const { data, error: emailError } = await resend.emails.send({
      from: 'Club Hello World <contacto@helloworld-unam.tech>',
      to: ['contacto@helloworld-unam.tech'], // Manda a contacto principal
      cc: ccArray, // CC a toda la mesa directiva
      subject: `🚨 Tienes ${count} solicitudes pendientes en el Leaderboard`,
      html: `
        <div style="background-color: #f5f3ff; padding: 3rem 1rem; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333;">
          <div style="text-align: center; margin-bottom: 2rem;">
            <div style="display: inline-block; border: 3px solid #000; padding: 0.5rem; background: #fff;">
              <img src="https://helloworld-unam.tech/img/favicon.png" width="48" height="48" alt="Hello World" style="display: block;" />
            </div>
          </div>

          <div style="max-width: 600px; margin: 0 auto; background: #fff; border: 3px solid #000; padding: 3rem 2.5rem;">
            
            <div style="display: inline-block; background: #fef08a; border: 2px solid #000; padding: 0.3rem 0.6rem; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2rem;">
              ✦ ACCIÓN REQUERIDA
            </div>

            <h1 style="color: #000; margin: 0 0 1.5rem 0; font-size: 2.2rem; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">
              HOLA, DIRECTIVA.
            </h1>

            <p style="font-size: 1.05rem; line-height: 1.6; margin-bottom: 1.5rem;">
              Este es su resumen automático. Al corte de hoy, tienen <strong>${count} evidencias pendientes</strong> de aprobación en el sistema.
            </p>

            <p style="font-size: 1.05rem; line-height: 1.6; margin-bottom: 2.5rem;">
              Por favor ingresen al panel de administración para auditar estos registros y mantener el Leaderboard actualizado.
            </p>

            <div style="text-align: center; margin-bottom: 3rem;">
              <a href="https://helloworld-unam.tech/admin" style="display: inline-block; background: #6225e6; color: #fff; text-decoration: none; font-weight: 800; font-size: 1.1rem; padding: 1rem 2rem; border: 2px solid #000; box-shadow: 4px 4px 0 #000; text-transform: uppercase; letter-spacing: 1px;">
                Ir al Panel de Admin →
              </a>
            </div>

            <p style="font-size: 0.85rem; color: #666; font-style: italic;">
              Nota: Si no hubiera solicitudes pendientes, este correo no habría llegado. Su sistema está optimizado para enviar notificaciones solo cuando es necesario.
            </p>

          </div>
        </div>
      `,
    });

    if (emailError) {
      throw new Error(emailError.message);
    }

    return new Response(JSON.stringify({ 
      message: "Resumen enviado exitosamente", 
      count: count,
      data 
    }), { status: 200 });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};
