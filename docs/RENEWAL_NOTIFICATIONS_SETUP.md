# Configuración de Notificaciones de Renovación de Suscripciones

## Descripción

La aplicación envía automáticamente correos de notificación a los miembros cuando su suscripción está próxima a vencer:
- **3 días antes**: Recordatorio de renovación
- **El mismo día**: Notificación urgente de vencimiento

## Componentes

### 1. Edge Function: `send-renewal-notifications`
- **Ubicación**: Supabase Edge Functions
- **Slug**: `send-renewal-notifications`
- **Método**: POST
- **Descripción**: Busca miembros con suscripción próxima a vencer y envía correos de notificación

### 2. Tabla de Registro: `renewal_notifications_log`
- Registra cada ejecución de la función
- Almacena cantidad de correos enviados, errores, etc.

### 3. Funciones TypeScript (Aplicación)
- `lib/actions/email.ts`: Función `sendRenewalNotification()`
- `lib/actions/renewal-notifications.ts`: Lógica de negocio

## Configuración del Cron Job

### Opción 1: Usar Supabase Cron (Recomendado)

Supabase permite configurar cron jobs directamente. Necesitas:

1. **Acceder a Supabase Dashboard**
   - Ve a tu proyecto en https://app.supabase.com
   - Navega a "Edge Functions"

2. **Crear un Cron Job**
   - En la sección de Edge Functions, busca la opción de "Cron"
   - Configura un cron job que ejecute la edge function diariamente

3. **Configuración recomendada**
   ```
   Horario: 08:00 UTC (o la hora que prefieras)
   Frecuencia: Diaria
   Función: send-renewal-notifications
   ```

### Opción 2: Usar GitHub Actions

Crea un archivo `.github/workflows/renewal-notifications.yml`:

```yaml
name: Send Renewal Notifications

on:
  schedule:
    # Ejecutar diariamente a las 8:00 AM UTC
    - cron: '0 8 * * *'

jobs:
  send-notifications:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger renewal notifications
        run: |
          curl -X POST \
            https://pnpoegsergczspixocez.supabase.co/functions/v1/send-renewal-notifications \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Content-Type: application/json"
```

### Opción 3: Usar Vercel Crons

Si usas Vercel, puedes crear un endpoint que Vercel ejecute automáticamente:

```typescript
// app/api/cron/renewal-notifications/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  // Verificar que sea una solicitud de Vercel
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const response = await fetch(
      'https://pnpoegsergczspixocez.supabase.co/functions/v1/send-renewal-notifications',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    )

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to send notifications' }, { status: 500 })
  }
}
```

Luego en `vercel.json`:

```json
{\n  "crons": [{\n    "path": "/api/cron/renewal-notifications",\n    "schedule": "0 8 * * *"\n  }]\n}
```

## Variables de Entorno Requeridas

La edge function necesita acceso a:
- `SUPABASE_URL`: URL de tu proyecto Supabase
- `SUPABASE_SERVICE_ROLE_KEY`: Clave de servicio de Supabase
- `GMAIL_USER`: Email de Gmail para enviar correos
- `GMAIL_APP_PASSWORD`: Contraseña de aplicación de Gmail
- `NEXT_PUBLIC_SITE_URL`: URL de tu aplicación (para el logo en los correos)

## Prueba Manual

Para probar la edge function manualmente:

```bash
curl -X POST \
  https://pnpoegsergczspixocez.supabase.co/functions/v1/send-renewal-notifications \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json"
```

O desde la aplicación:

```typescript
import { sendRenewalNotifications } from '@/lib/actions/renewal-notifications'

const result = await sendRenewalNotifications()
console.log(result)
```

## Monitoreo

Para monitorear las ejecuciones:

```sql
-- Ver últimas ejecuciones
SELECT * FROM renewal_notifications_log 
ORDER BY executed_at DESC 
LIMIT 10;

-- Ver estadísticas
SELECT 
  DATE(executed_at) as fecha,
  COUNT(*) as ejecuciones,
  SUM(sent_count) as total_correos_enviados,
  AVG(sent_count) as promedio_correos
FROM renewal_notifications_log
WHERE executed_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(executed_at)
ORDER BY fecha DESC;
```

## Troubleshooting

### Los correos no se envían
1. Verifica que `GMAIL_USER` y `GMAIL_APP_PASSWORD` estén configurados en Supabase
2. Revisa los logs de la edge function en Supabase Dashboard
3. Verifica que los miembros tengan email y status "active"

### La edge function falla
1. Revisa los logs en Supabase Dashboard → Edge Functions → send-renewal-notifications
2. Verifica que la tabla `members` tenga los datos correctos
3. Asegúrate de que `gym_settings` tenga al menos un registro

### Los correos llegan a spam
1. Configura SPF, DKIM y DMARC en tu dominio
2. Usa un servicio de email profesional como SendGrid o Resend en lugar de Gmail
3. Personaliza el "From" con tu dominio

## Próximos Pasos

1. Configura el cron job según tu preferencia
2. Prueba manualmente la edge function
3. Monitorea los logs en `renewal_notifications_log`
4. Ajusta el horario según tus necesidades
