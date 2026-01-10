"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"

interface DolarAPIResponse {
  fuente: string
  nombre: string
  compra: number
  venta: number
  promedio: number
  fechaActualizacion: string
}

/**
 * Obtiene la tasa del Dólar Oficial (BCV) desde DolarAPI
 */
export async function getDolarOficialRate(): Promise<{
  rate: number
  success: boolean
  error?: string
}> {
  try {
    const response = await fetch(
      "https://ve.dolarapi.com/v1/dolares/oficial",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    )

    if (!response.ok) {
      throw new Error(`Error de DolarAPI: ${response.status}`)
    }

    const data: DolarAPIResponse = await response.json()

    // Usar el promedio o venta si no hay promedio
    const rate = data.promedio || data.venta || 0

    if (rate === 0) {
      throw new Error("No se pudo obtener la tasa BCV")
    }

    // Redondear a 2 decimales
    const finalRate = Math.round(rate * 100) / 100

    return { rate: finalRate, success: true }
  } catch (error) {
    console.error("Error al obtener tasa BCV:", error)
    return {
      rate: 0,
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    }
  }
}

/**
 * Obtiene la tasa del Dólar Paralelo desde DolarAPI
 */
export async function getDolarParaleloRate(): Promise<{
  rate: number
  success: boolean
  error?: string
}> {
  try {
    const response = await fetch(
      "https://ve.dolarapi.com/v1/dolares/paralelo",
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    )

    if (!response.ok) {
      throw new Error(`Error de DolarAPI: ${response.status}`)
    }

    const data: DolarAPIResponse = await response.json()

    // Usar el promedio o venta si no hay promedio
    const rate = data.promedio || data.venta || 0

    if (rate === 0) {
      throw new Error("No se pudo obtener la tasa paralela")
    }

    // Redondear a 2 decimales
    const finalRate = Math.round(rate * 100) / 100

    return { rate: finalRate, success: true }
  } catch (error) {
    console.error("Error al obtener tasa paralela:", error)
    return {
      rate: 0,
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
    }
  }
}

/**
 * Sincroniza la tasa BCV desde DolarAPI y la guarda en la base de datos
 */
export async function syncBCVRate(): Promise<{
  rate: number
  success: boolean
  error?: string
}> {
  const result = await getDolarOficialRate()

  if (!result.success) {
    return result
  }

  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from("exchange_rates")
      .update({
        rate: result.rate,
        updated_at: new Date().toISOString(),
      })
      .eq("type", "BCV")

    if (error) {
      throw error
    }

    revalidatePath("/dashboard")
    revalidatePath("/dashboard/settings")

    return { rate: result.rate, success: true }
  } catch (error) {
    console.error("Error al guardar tasa BCV:", error)
    return {
      rate: result.rate,
      success: false,
      error: error instanceof Error ? error.message : "Error al guardar en base de datos",
    }
  }
}

/**
 * Sincroniza la tasa USDT (Paralelo) desde DolarAPI y la guarda en la base de datos
 */
export async function syncUSDTRate(): Promise<{
  rate: number
  success: boolean
  error?: string
}> {
  const result = await getDolarParaleloRate()

  if (!result.success) {
    return result
  }

  try {
    const supabase = await createClient()

    const { error } = await supabase
      .from("exchange_rates")
      .update({
        rate: result.rate,
        updated_at: new Date().toISOString(),
      })
      .eq("type", "USDT")

    if (error) {
      throw error
    }

    revalidatePath("/dashboard")
    revalidatePath("/dashboard/settings")

    return { rate: result.rate, success: true }
  } catch (error) {
    console.error("Error al guardar tasa USDT:", error)
    return {
      rate: result.rate,
      success: false,
      error: error instanceof Error ? error.message : "Error al guardar en base de datos",
    }
  }
}

// Mantener compatibilidad con el nombre anterior
export const syncBinanceUSDTRate = syncUSDTRate

