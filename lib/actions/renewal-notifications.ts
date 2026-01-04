"use server"

import { createClient } from "@/utils/supabase/server"
import { sendRenewalNotification } from "./email"

/**
 * Envía notificaciones de renovación a miembros cuya suscripción vence en 3 días o hoy
 * Esta función debe ejecutarse diariamente (puede ser via cron job o webhook)
 */
export async function sendRenewalNotifications() {
  const supabase = await createClient()
  const today = new Date().toISOString().split("T")[0]
  
  // Calcular fecha de hace 3 días
  const threeDaysFromNow = new Date()
  threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3)
  const threeDaysFromNowStr = threeDaysFromNow.toISOString().split("T")[0]

  try {
    // Obtener miembros activos cuya suscripción vence hoy o en 3 días
    const { data: members, error } = await supabase
      .from("members")
      .select("id, name, email, payment_date, plan_id, plans(name)")
      .eq("status", "active")
      .eq("frozen", false)
      .in("payment_date", [today, threeDaysFromNowStr])

    if (error) {
      console.error("Error obteniendo miembros para notificación:", error)
      return { success: false, error: error.message }
    }

    if (!members || members.length === 0) {
      console.log("No hay miembros con suscripción próxima a vencer")
      return { success: true, sent: 0 }
    }

    let sentCount = 0
    const errors: string[] = []

    // Enviar notificación a cada miembro
    for (const member of members as any[]) {
      try {
        const paymentDate = new Date(member.payment_date)
        const todayDate = new Date(today)
        const daysUntilExpiry = Math.ceil((paymentDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24))

        // Obtener el nombre del plan
        let planName: string | undefined
        if (member.plans && Array.isArray(member.plans) && member.plans.length > 0) {
          planName = member.plans[0].name
        }

        const result = await sendRenewalNotification({
          to: member.email,
          memberName: member.name,
          planName: planName,
          daysUntilExpiry: Math.max(daysUntilExpiry, 0), // Asegurar que no sea negativo
          expiryDate: new Date(member.payment_date).toLocaleDateString("es-ES", {
            year: "numeric",
            month: "long",
            day: "numeric",
          }),
        })

        if (result.success) {
          sentCount++
          console.log(`Notificación enviada a ${member.email}`)
        } else {
          errors.push(`Error enviando a ${member.email}: ${result.error}`)
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Error desconocido"
        errors.push(`Error procesando ${member.email}: ${errorMsg}`)
      }
    }

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
