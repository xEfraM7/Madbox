# Configuración de Notificaciones de Renovación de Suscripciones

## Descripción

La aplicación envía automáticamente correos de notificación a los miembros cuando su suscripción está próxima a vencer:
- **3 días antes**: Recordatorio de renovación
- **El mismo día**: Notificación urgente de vencimiento

El envío se hace con **Resend** desde el dominio configurado.

## Componentes

### 1. Endpoint del cron: `app/api/cron/renewal-notifications/route.ts`
- Método: `GET`
- Protegido con header `Authorization: Bearer ${CRON_SECRET}`
- Llama a `sendRenewalNotifications()` y devuelve el resultado en JSON

### 2. Programación: `vercel.json`
```json
{
  "crons": [
    { "path": "/api/cron/renewal-notifications", "schedule": "0 12 * * *" }
  ]
}
```
`0 12 * * *` = **12:00 UTC** todos los días (≈ 8:00 AM hora Venezuela, UTC-4). Ajusta el horario si lo necesitas. Vercel Cron solo soporta granularidad por hora en planes gratuitos.

### 3. Tablas de registro
- `renewal_notifications_log`: registra cada **ejecución** del cron (correos enviados, total de miembros, errores, estado).
- `renewal_notification_sends`: registra cada **aviso individual** enviado, con `UNIQUE (member_id, expiry_date, kind)` donde `kind` es `reminder` (3 días antes) o `urgent` (el mismo día). Es lo que permite consultar por rango sin reenviar el mismo aviso a diario.

### 4. Funciones TypeScript
- `lib/actions/email.ts`: `sendWelcomeEmail()` y `sendRenewalNotification()` (Resend)
- `lib/actions/renewal-notifications.ts`: `sendRenewalNotifications()` (lógica de negocio que recorre miembros y dispara los correos)

**Robustez del envío:**
- Usa el **cliente admin** (`service_role`): el cron corre sin sesión de usuario, así que el cliente SSR basado en cookies sería bloqueado por RLS. Requiere `SUPABASE_SERVICE_ROLE_KEY`.
- Consulta por **rango** (hoy..hoy+3), no por días exactos: si el cron se salta un día, el aviso igual sale al día siguiente.
- **Deduplica** con `renewal_notification_sends`: cada miembro recibe a lo sumo un `reminder` y un `urgent` por fecha de vencimiento.

## Variables de entorno

En `.env.local` y en **Vercel → Settings → Environment Variables**:

```
RESEND_API_KEY=re_xxxxxxxxxx
RESEND_FROM_EMAIL=Madbox <no-reply@tudominio.com>
CRON_SECRET=<una-cadena-aleatoria-larga>
NEXT_PUBLIC_SITE_URL=https://tudominio.com
SUPABASE_SERVICE_ROLE_KEY=<service_role de Supabase>  # requerido: el cron lee/escribe con bypass de RLS
```

- `RESEND_FROM_EMAIL` puede ser solo el correo (`no-reply@tudominio.com`) — en ese caso el código antepone el nombre del gimnasio automáticamente — o ya venir con formato `"Nombre <correo@dominio>"`.
- `CRON_SECRET` lo genera Vercel automáticamente al detectar `crons` en `vercel.json`. Verifícalo en **Settings → Environment Variables** después del primer deploy.

## Prueba manual

En local (con el server corriendo):

```bash
curl -X GET \
  http://localhost:3000/api/cron/renewal-notifications \
  -H "Authorization: Bearer $CRON_SECRET"
```

En producción:

```bash
curl -X GET \
  https://tudominio.com/api/cron/renewal-notifications \
  -H "Authorization: Bearer $CRON_SECRET"
```

O desde código:

```typescript
import { sendRenewalNotifications } from '@/lib/actions/renewal-notifications'

const result = await sendRenewalNotifications()
console.log(result)
```

## Monitoreo

```sql
-- Últimas ejecuciones
SELECT * FROM renewal_notifications_log
ORDER BY executed_at DESC
LIMIT 10;

-- Estadísticas mensuales
SELECT
  DATE(executed_at) AS fecha,
  COUNT(*) AS ejecuciones,
  SUM(sent_count) AS total_correos_enviados,
  AVG(sent_count) AS promedio_correos
FROM renewal_notifications_log
WHERE executed_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(executed_at)
ORDER BY fecha DESC;
```

Adicionalmente, en el dashboard de Resend → **Logs** ves cada email enviado, su estado (delivered, bounced, complained) y el cuerpo.

## Troubleshooting

### Los correos no se envían
1. Verifica que `RESEND_API_KEY` y `RESEND_FROM_EMAIL` estén configurados en Vercel.
2. Confirma en Resend → **Domains** que el dominio está **Verified** (DNS aplicados correctamente).
3. Revisa los logs en Resend para ver el error exacto del envío.
4. Verifica que los miembros tengan `email`, `status = "active"` y `frozen = false`.

### Error 401 al ejecutar el cron manualmente
- Falta el header `Authorization: Bearer <CRON_SECRET>` o el valor no coincide con la env var.

### Los correos llegan a spam
- Asegúrate de tener SPF, DKIM y DMARC verificados (Resend los provee al añadir el dominio).
- Usa un `from` con tu dominio verificado, no un Gmail genérico.

## Migración previa (histórico)

Antes de Resend este flujo usaba **Gmail SMTP vía nodemailer** y una **Edge Function de Supabase** (`send-renewal-notifications`). Ambos quedaron sustituidos por la ruta `/api/cron/renewal-notifications` en este proyecto. Si la edge function aún existe en Supabase, puedes borrarla desde el dashboard.
