# Migración de entrevistas por salas a producción — 3 de octubre de 2026

## Análisis y alcance

Producción: `hzewxtimkbxljozyrafk`, temporada activa `2027-1`, sitio `clubhelloworld.com`. Auditoría inicial: **69 solicitudes** (56 aceptadas en Forms, 13 rechazadas), **23 miembros**, **130 registros de puntos**, ninguna entrevista, ninguna invitación inicial enviada o vigente. Las seis jornadas anteriores pertenecen a otras temporadas y están en el pasado: se conservan sin convertirlas ni eliminarlas. El flujo progresivo ya está activo; no se debe ejecutar otra vez su activación.

Las migraciones de notificaciones y preparación de correo `20261003005222` y `20261003011045` ya están aplicadas en producción. Se incorporan sus fuentes al repositorio para documentar el estado real, sin volver a ejecutarlas. El dispatcher remoto ya es v10: se compara su fuente antes de decidir si hace falta publicarlo.

| Cambios del día | Tratamiento |
| --- | --- |
| Salas, bloques, responsables, Meet restringido, coanfitriones, eventos Calendar y reservas por sala | Migrar esquema, RPC, worker Calendar y frontend. |
| Retiro de agenda anterior y checklist manual | Migrar la UI y retirar escrituras antiguas; conservar sus datos históricos. |
| Capacidad publicada antes de invitar, concurrencia y ayuda para crear jornadas | Migrar validación de servidor y frontend. |
| Eliminar salas/horarios antes del primer correo inicial; cancelación durable en Google | Migrar con protección de reservas, envíos y capacidad comprometida. |
| Solicitudes: filtros compactos, estados de correo y avisos contextuales | Migrar. |
| Entrevistas: contadores correctos, filtros operativos, sala, anfitrión, respaldo y Meet | Migrar. |
| Progreso, errores, éxito y resumen de lo guardado en Google; formulario responsive | Migrar. |
| Recordatorios configurables y plantillas transaccionales usadas por entrevistas | Conservar la configuración vigente; comparar con las funciones ya publicadas. |
| Buzón, catálogo, sincronización de plantillas, procesamiento local de correo, banner y cambios de laboratorio | Excluir los cambios del release. Ningún dato o secreto local de Supabase se copia. |
| Cuentas/postulantes sintéticos, reinicios, mensajes y eventos de ensayo | Excluir. |
| `presentation-library`, pnpm y ajustes de desarrollo ajenos al flujo productivo | Excluir; mantener npm y su lockfile vigente. |
| Tests aislados y utilidades de autorización/cifrado Google | Incorporar como herramientas de mantenimiento; no son datos ni endpoints de buzón. |

## To-do ejecutable

- [x] Revisar todos los archivos modificados y preparar un worktree de release selectivo desde `origin/main`.
- [x] Auditar producción sólo con metadatos y confirmar compatibilidad de las jornadas históricas.
- [x] Comparar dispatcher publicado y verificar las nuevas credenciales Google con los permisos necesarios.
- [x] Ejecutar tipos, pruebas unitarias, Edge, base de datos, E2E y build del release selectivo.
- [x] Guardar backup privado transaccional, exportación fuera de Git, definiciones de funciones y respaldo de CVs; registrar hashes.
- [x] Ensayar las cuatro migraciones nuevas contra el esquema productivo en transacción reversible y comprobar integridad.
- [ ] Crear commit/PR con el manifiesto exacto de release y preparar despliegue de Vercel sin promoverlo.
- [ ] Pausar temporalmente sólo el despacho automático y verificar que no haya trabajos en vuelo.
- [ ] Aplicar individualmente, con registro de historial y límites de espera: `20261003181805`, `20261003211000`, `20261004002000`, `20261004010000`.
- [ ] Instalar sólo las credenciales Google cifradas actualizadas, publicar `selection-calendar` y añadir su cron conservando el cron de correo.
- [ ] Verificar invariantes de solicitudes, miembros, puntos, CVs, tokens, comunicaciones y configuración; revisar permisos de los RPC.
- [ ] Publicar el frontend de producción y comprobar páginas públicas, login y ausencia de herramientas de laboratorio.
- [ ] Reponer el estado previo del dispatcher, conciliar cron y registrar URLs, SHA y resultado final.

## Invariantes y recuperación

El release no crea salas reales, no publica horarios, no invita a aspirantes, no comunica decisiones y no reinicia su proceso. Directiva preparará las jornadas con capacidad suficiente desde el nuevo panel. No se migran filas del laboratorio, ni eventos de ensayo, ni cuentas de prueba.

No usar `db push`, `db reset`, seeds ni reparación masiva del historial: producción tiene migraciones históricas que el repositorio no contiene. Registrar únicamente las cuatro migraciones revisadas dentro de su misma transacción. Mantener íntegros los registros anteriores y comparar hashes de solicitudes/miembros/puntos/CVs antes y después, permitiendo únicamente nuevas solicitudes legítimas recibidas durante la ventana.

Si falla la verificación, mantener el dispatcher pausado y el frontend anterior. El rollback de Vercel usa el deployment previo; una restauración de datos nunca debe sobrescribir solicitudes nuevas. Conservar las funciones SQL anteriores para una reparación dirigida. Los eventos externos ya enviados no se revierten con un rollback de base de datos.

Documentación consultada: [Supabase CLI](https://supabase.com/docs/reference/cli/supabase-functions-deploy), [Vercel deploy](https://vercel.com/docs/cli/deploy), [Astro en Vercel](https://docs.astro.build/en/guides/integrations-guide/vercel/).

## Evidencia previa al corte

Release selectivo: 35 E2E, 31 pruebas Edge, pruebas unitarias de correo/Calendar/Meet, pruebas SQL y concurrencia aprobadas; tipos sin errores y build de Astro completo. Ensayo transaccional de las cuatro migraciones contra el esquema real aprobado, con rollback verificado. Respaldo externo de 24 CVs y de todos los datos públicos/cola/funciones en archivo AES-256-GCM; descifrado y SHA-256 comprobados, llave separada. El asesor de seguridad detecta un hallazgo previo en `public.ranking_por_periodo`, ajeno a este release; se compara al terminar sin modificar esa vista.

El dispatcher remoto v10 difiere únicamente en dos textos de admisión a Meet (HTML y texto plano); se publicará esta actualización sin reenviar mensajes existentes. Las credenciales institucionales verificadas incluyen `calendar.events.owned`, `meetings.space.created` y `meetings.space.settings`.
