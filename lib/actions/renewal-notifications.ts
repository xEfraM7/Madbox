"use server"

import { createClient } from "@/utils/supabase/server"
import { createAdminClient } from "@/utils/supabase/admin"
import { sendRenewalNotification } from "./email"

const REMINDER_DAYS = 3

/** Fecha de hoy (YYYY-MM-DD) en la zona horaria del gimnasio. */
function caracasTodayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

/** Suma días a una fecha YYYY-MM-DD usando aritmética UTC pura (sin drift de zona horaria). */
function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z")
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split("T")[0]
}

function daysBetween(fromISO: string, toISO: string): number {
  return Math.round(
    (Date.parse(toISO + "T00:00:00Z") - Date.parse(fromISO + "T00:00:00Z")) / 86_400_000,
  )
}

/**
 * Envía notificaciones de renovación a miembros cuya suscripción vence dentro de
 * los próximos {@link REMINDER_DAYS} días o hoy. Pensado para ejecutarse a diario.
 *
 * Robustez:
 * - Usa el cliente admin (service_role): el cron no tiene sesión, así que el cliente
 *   SSR basado en cookies sería bloqueado por RLS.
 * - Consulta por RANGO (hoy..hoy+3), no por días exactos: si el cron se salta un día,
 *   el aviso igual sale al día siguiente.
 * - Deduplica con `renewal_notification_sends` (member_id, expiry_date, kind) para no
 *   reenviar el mismo aviso cada día dentro de la ventana.
 */
export async function sendRenewalNotifications() {
  const supabase = createAdminClient()
  const today = caracasTodayISO()
  const horizon = addDaysISO(today, REMINDER_DAYS)

  try {
    const { data: members, error } = await supabase
      .from("members")
      .select("id, name, email, payment_date, plan_id, plans(name)")
      .eq("status", "active")
      .eq("frozen", false)
      .not("email", "is", null)
      .gte("payment_date", today)
      .lte("payment_date", horizon)

    if (error) {
      console.error("Error obteniendo miembros para notificación:", error)
      return { success: false, error: error.message }
    }

    if (!members || members.length === 0) {
      await logExecution(supabase, 0, 0, [])
      console.log("No hay miembros con suscripción próxima a vencer")
      return { success: true, sent: 0, total: 0 }
    }

    // Cargar de una sola vez los avisos ya enviados para estos miembros.
    const memberIds = members.map((m: any) => m.id)
    const { data: alreadySent } = await supabase
      .from("renewal_notification_sends")
      .select("member_id, expiry_date, kind")
      .in("member_id", memberIds)

    const sentKeys = new Set(
      (alreadySent ?? []).map((s: any) => `${s.member_id}|${s.expiry_date}|${s.kind}`),
    )

    let sentCount = 0
    const errors: string[] = []

    for (const member of members as any[]) {
      try {
        if (!member.email) continue

        const expiry: string = member.payment_date
        const daysUntilExpiry = daysBetween(today, expiry)
        const kind: "reminder" | "urgent" = daysUntilExpiry <= 0 ? "urgent" : "reminder"
        const dedupKey = `${member.id}|${expiry}|${kind}`

        if (sentKeys.has(dedupKey)) continue // ya se le avisó este ciclo

        const planName = Array.isArray(member.plans)
          ? member.plans[0]?.name
          : member.plans?.name

        const result = await sendRenewalNotification({
          to: member.email,
          memberName: member.name,
          planName,
          daysUntilExpiry: Math.max(daysUntilExpiry, 0),
          expiryDate: new Date(expiry + "T00:00:00").toLocaleDateString("es-ES", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
        })

        if (result.success) {
          sentCount++
          sentKeys.add(dedupKey)
          await supabase
            .from("renewal_notification_sends")
            .insert({ member_id: member.id, expiry_date: expiry, kind })
          console.log(`Notificación (${kind}) enviada a ${member.email}`)
        } else {
          errors.push(`Error enviando a ${member.email}: ${result.error}`)
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Error desconocido"
        errors.push(`Error procesando ${member.email}: ${errorMsg}`)
      }
    }

    await logExecution(supabase, sentCount, members.length, errors)

    return {
      success: true,
      sent: sentCount,
      total: members.length,
      errors: errors.length > 0 ? errors : undefined,
    }
  } catch (error) {
    console.error("Error en sendRenewalNotifications:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    }
  }
}

/** Registra cada corrida del cron en `renewal_notifications_log` para monitoreo. */
async function logExecution(
  supabase: ReturnType<typeof createAdminClient>,
  sentCount: number,
  totalMembers: number,
  errors: string[],
) {
  try {
    await supabase.from("renewal_notifications_log").insert({
      executed_at: new Date().toISOString(),
      sent_count: sentCount,
      total_members: totalMembers,
      errors: errors.length > 0 ? errors : null,
      status: errors.length > 0 ? "partial" : "success",
    })
  } catch (err) {
    console.error("No se pudo registrar la ejecución en renewal_notifications_log:", err)
  }
}

/**
 * Obtiene miembros cuya suscripción vence en los próximos N días
 * Útil para mostrar en el dashboard
 */
export async function getMembersWithUpcomingExpiry(daysAhead: number = 7) {
  const supabase = await createClient()
  const today = new Date()
  const futureDate = new Date(today)
  futureDate.setDate(futureDate.getDate() + daysAhead)

  const todayStr = today.toISOString().split("T")[0]
  const futureDateStr = futureDate.toISOString().split("T")[0]

  try {
    const { data: members, error } = await supabase
      .from("members")
      .select("id, name, email, payment_date, plan_id, plans(name), status")
      .eq("frozen", false)
      .gte("payment_date", todayStr)
      .lte("payment_date", futureDateStr)
      .order("payment_date", { ascending: true })

    if (error) {
      console.error("Error obteniendo miembros con vencimiento próximo:", error)
      return []
    }

    return (members || []).map((member: any) => ({
      ...member,
      planName: member.plans && Array.isArray(member.plans) && member.plans.length > 0 ? member.plans[0].name : undefined,
      daysUntilExpiry: Math.ceil(
        (new Date(member.payment_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      ),
    }))
  } catch (error) {
    console.error("Error en getMembersWithUpcomingExpiry:", error)
    return []
  }
}
