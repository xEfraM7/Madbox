"use server"

import nodemailer from "nodemailer"
import { createClient } from "@/utils/supabase/server"

interface WelcomeEmailParams {
  to: string
  memberName: string
  planName?: string
  gymName?: string
}

interface RenewalNotificationParams {
  to: string
  memberName: string
  planName?: string
  daysUntilExpiry: number
  expiryDate: string
  gymName?: string
}

// Crear transporter de Gmail
function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  })
}

export async function sendWelcomeEmail(params: WelcomeEmailParams) {
  const { to, memberName, planName, gymName = "Madbox" } = params

  const gmailUser = process.env.GMAIL_USER
  const gmailPassword = process.env.GMAIL_APP_PASSWORD

  if (!gmailUser || !gmailPassword) {
    console.log("Gmail no configurado. Email de bienvenida no enviado a:", to)
    return { success: false, error: "Email service not configured" }
  }

  // Obtener configuración del gimnasio
  const supabase = await createClient()
  const { data: settings } = await supabase
    .from("gym_settings")
    .select("name, email, phone, address")
    .single()

  const finalGymName = settings?.name || gymName
  // URL del logo - usar la URL pública
  const logoUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/Madbox_logo.jpeg`

  try {
    const transporter = createTransporter()

    const mailOptions = {
      from: `"${finalGymName}" <${gmailUser}>`,
      to: to,
      subject: `¡Bienvenido a ${finalGymName}!`,
      html: generateWelcomeEmailHtml({
        memberName,
        planName,
        gymName: finalGymName,
        gymEmail: settings?.email,
        gymPhone: settings?.phone,
        gymAddress: settings?.address,
        logoUrl,
      }),
    }

    const info = await transporter.sendMail(mailOptions)
    console.log("Email de bienvenida enviado:", info.messageId)
    return { success: true, id: info.messageId }
  } catch (error) {
    console.error("Error enviando email de bienvenida:", error)
    return { success: false, error: "Failed to send email" }
  }
}

export async function sendRenewalNotification(params: RenewalNotificationParams) {
  const { to, memberName, planName, daysUntilExpiry, expiryDate, gymName = "Madbox" } = params

  const gmailUser = process.env.GMAIL_USER
  const gmailPassword = process.env.GMAIL_APP_PASSWORD

  if (!gmailUser || !gmailPassword) {
    console.log("Gmail no configurado. Email de renovación no enviado a:", to)
    return { success: false, error: "Email service not configured" }
  }

  // Obtener configuración del gimnasio
  const supabase = await createClient()
  const { data: settings } = await supabase
    .from("gym_settings")
    .select("name, email, phone, address")
    .single()

  const finalGymName = settings?.name || gymName
  const logoUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/Madbox_logo.jpeg`

  try {
    const transporter = createTransporter()

    const subject = daysUntilExpiry === 0 
      ? `⚠️ Tu suscripción a ${finalGymName} vence hoy`
      : `⏰ Tu suscripción a ${finalGymName} vence en ${daysUntilExpiry} días`

    const mailOptions = {
      from: `"${finalGymName}" <${gmailUser}>`,
      to: to,
      subject: subject,
      html: generateRenewalNotificationHtml({
        memberName,
        planName,
        daysUntilExpiry,
        expiryDate,
        gymName: finalGymName,
        gymEmail: settings?.email,
        gymPhone: settings?.phone,
        gymAddress: settings?.address,
        logoUrl,
      }),
    }

    const info = await transporter.sendMail(mailOptions)
    console.log("Email de renovación enviado:", info.messageId)
    return { success: true, id: info.messageId }
  } catch (error) {
    console.error("Error enviando email de renovación:", error)
    return { success: false, error: "Failed to send email" }
  }
}

function generateWelcomeEmailHtml(params: {
  memberName: string
  planName?: string
  gymName: string
  gymEmail?: string | null
  gymPhone?: string | null
  gymAddress?: string | null
  logoUrl: string
}) {
  const { memberName, planName, gymName, gymEmail, gymPhone, gymAddress, logoUrl } = params

  // Colores de la app: Amarillo/Dorado y Negro
  const colors = {
    primary: "#D4A017", // Amarillo dorado
    primaryLight: "#E8B923",
    dark: "#1a1a1a", // Negro
    darkLight: "#2d2d2d",
    text: "#333333",
    textMuted: "#666666",
    background: "#f5f5f5",
    white: "#ffffff",
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenido a ${gymName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: ${colors.background};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${colors.background}; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: ${colors.white}; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);">
          <!-- Header con Logo -->
          <tr>
            <td style="background: ${colors.dark}; padding: 30px; text-align: center;">
              <img src="${logoUrl}" alt="${gymName}" style="max-width: 180px; max-height: 80px; margin-bottom: 10px; display: block; margin-left: auto; margin-right: auto;" />
            </td>
          </tr>
          
          <!-- Barra amarilla decorativa -->
          <tr>
            <td style="background: linear-gradient(90deg, ${colors.primary} 0%, ${colors.primaryLight} 100%); height: 6px;"></td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 35px;">
              <h2 style="color: ${colors.dark}; margin: 0 0 25px 0; font-size: 26px; font-weight: 600;">
                ¡Bienvenido, ${memberName}! 💪
              </h2>
              
              <p style="color: ${colors.text}; font-size: 16px; line-height: 1.7; margin: 0 0 25px 0;">
                Nos alegra mucho tenerte como parte de la familia <strong style="color: ${colors.primary};">${gymName}</strong>. 
                Tu registro ha sido completado exitosamente.
              </p>
              
              ${planName ? `
              <div style="background: linear-gradient(135deg, ${colors.dark} 0%, ${colors.darkLight} 100%); border-radius: 12px; padding: 25px; margin: 25px 0; border-left: 4px solid ${colors.primary};">
                <p style="color: ${colors.primary}; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px 0; font-weight: 600;">Tu plan activo</p>
                <p style="color: ${colors.white}; font-size: 22px; font-weight: 700; margin: 0;">${planName}</p>
              </div>
              ` : ''}
              
              <p style="color: ${colors.text}; font-size: 16px; line-height: 1.7; margin: 25px 0;">
                Estamos aquí para ayudarte a alcanzar tus metas. Si tienes alguna pregunta, no dudes en contactarnos.
              </p>
              
              <div style="text-align: center; margin: 35px 0; padding: 25px; background-color: ${colors.background}; border-radius: 12px;">
                <p style="color: ${colors.dark}; font-size: 18px; margin: 0 0 5px 0;">¿Listo para empezar?</p>
                <p style="color: ${colors.primary}; font-size: 24px; font-weight: bold; margin: 0;">¡Te esperamos! 🏋️</p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: ${colors.dark}; padding: 30px; text-align: center;">
              <p style="color: ${colors.primary}; font-size: 16px; font-weight: 600; margin: 0 0 15px 0;">${gymName}</p>
              ${gymAddress ? `<p style="color: #999999; font-size: 13px; margin: 0 0 8px 0;">📍 ${gymAddress}</p>` : ''}
              ${gymPhone ? `<p style="color: #999999; font-size: 13px; margin: 0 0 8px 0;">📞 ${gymPhone}</p>` : ''}
              ${gymEmail ? `<p style="color: #999999; font-size: 13px; margin: 0;">✉️ ${gymEmail}</p>` : ''}
              
              <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #333;">
                <p style="color: #666666; font-size: 11px; margin: 0;">
                  Este correo fue enviado automáticamente. Por favor no responder.
                </p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `
}

function generateRenewalNotificationHtml(params: {
  memberName: string
  planName?: string
  daysUntilExpiry: number
  expiryDate: string
  gymName: string
  gymEmail?: string | null
  gymPhone?: string | null
  gymAddress?: string | null
  logoUrl: string
}) {
  const { memberName, planName, daysUntilExpiry, expiryDate, gymName, gymEmail, gymPhone, gymAddress, logoUrl } = params

  // Colores de la app: Amarillo/Dorado y Negro
  const colors = {
    primary: "#D4A017", // Amarillo dorado
    primaryLight: "#E8B923",
    dark: "#1a1a1a", // Negro
    darkLight: "#2d2d2d",
    text: "#333333",
    textMuted: "#666666",
    background: "#f5f5f5",
    white: "#ffffff",
    warning: "#FF6B6B", // Rojo para advertencia
  }

  const isExpiring = daysUntilExpiry === 0
  const headerColor = isExpiring ? colors.warning : colors.primary

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Renovación de suscripción - ${gymName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: ${colors.background};">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: ${colors.background}; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: ${colors.white}; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);">
          <!-- Header con Logo -->
          <tr>
            <td style="background: ${colors.dark}; padding: 30px; text-align: center;">
              <img src="${logoUrl}" alt="${gymName}" style="max-width: 180px; max-height: 80px; margin-bottom: 10px; display: block; margin-left: auto; margin-right: auto;" />
            </td>
          </tr>
          
          <!-- Barra de alerta -->
          <tr>
            <td style="background: linear-gradient(90deg, ${headerColor} 0%, ${isExpiring ? '#FF8787' : colors.primaryLight} 100%); height: 6px;"></td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 35px;">
              <h2 style="color: ${isExpiring ? colors.warning : colors.dark}; margin: 0 0 25px 0; font-size: 26px; font-weight: 600;">
                ${isExpiring ? '⚠️ Tu suscripción vence hoy' : '⏰ Tu suscripción vence pronto'}
              </h2>
              
              <p style="color: ${colors.text}; font-size: 16px; line-height: 1.7; margin: 0 0 25px 0;">
                Hola <strong>${memberName}</strong>,
              </p>

              ${isExpiring ? `
              <p style="color: ${colors.warning}; font-size: 16px; line-height: 1.7; margin: 0 0 25px 0; font-weight: 600;">
                Tu suscripción a ${gymName} vence <strong>hoy</strong>. Por favor, renuévala lo antes posible para no perder acceso a nuestras instalaciones.
              </p>
              ` : `
              <p style="color: ${colors.text}; font-size: 16px; line-height: 1.7; margin: 0 0 25px 0;">
                Tu suscripción a ${gymName} vence en <strong>${daysUntilExpiry} días</strong> (${expiryDate}). 
                Te recomendamos renovarla ahora para no interrumpir tu entrenamiento.
              </p>
              `}
              
              <div style="background: linear-gradient(135deg, ${colors.dark} 0%, ${colors.darkLight} 100%); border-radius: 12px; padding: 25px; margin: 25px 0; border-left: 4px solid ${headerColor};">
                <p style="color: ${colors.primary}; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px 0; font-weight: 600;">Detalles de tu suscripción</p>
                ${planName ? `<p style="color: ${colors.white}; font-size: 16px; font-weight: 700; margin: 0 0 8px 0;">Plan: ${planName}</p>` : ''}
                <p style="color: ${colors.white}; font-size: 16px; font-weight: 700; margin: 0;">Vencimiento: ${expiryDate}</p>
              </div>
              
              <p style="color: ${colors.text}; font-size: 16px; line-height: 1.7; margin: 25px 0;">
                Para renovar tu suscripción, contacta con nosotros o visita nuestras instalaciones. 
                Estamos aquí para ayudarte a mantener tu rutina de entrenamiento.
              </p>
              
              <div style="text-align: center; margin: 35px 0; padding: 25px; background-color: ${colors.background}; border-radius: 12px;">
                <p style="color: ${colors.dark}; font-size: 18px; margin: 0 0 5px 0;">¿Preguntas?</p>
                <p style="color: ${colors.primary}; font-size: 16px; font-weight: bold; margin: 0;">¡Contáctanos! 💪</p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: ${colors.dark}; padding: 30px; text-align: center;">
              <p style="color: ${colors.primary}; font-size: 16px; font-weight: 600; margin: 0 0 15px 0;">${gymName}</p>
              ${gymAddress ? `<p style="color: #999999; font-size: 13px; margin: 0 0 8px 0;">📍 ${gymAddress}</p>` : ''}
              ${gymPhone ? `<p style="color: #999999; font-size: 13px; margin: 0 0 8px 0;">📞 ${gymPhone}</p>` : ''}
              ${gymEmail ? `<p style="color: #999999; font-size: 13px; margin: 0;">✉️ ${gymEmail}</p>` : ''}
              
              <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #333;">
                <p style="color: #666666; font-size: 11px; margin: 0;">
                  Este correo fue enviado automáticamente. Por favor no responder.
                </p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `
}
