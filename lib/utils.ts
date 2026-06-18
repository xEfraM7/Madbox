import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { differenceInYears } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Calcula la fecha de vencimiento del mes siguiente
 * Si paga el día 15, vence el 15 del mes siguiente
 * Maneja casos especiales como el 31 de enero -> 28/29 de febrero
 */
export function getNextMonthDate(date: Date | string): Date {
  const d = typeof date === "string" ? new Date(date + "T00:00:00") : new Date(date)
  const day = d.getDate()
  
  // Avanzar al mes siguiente
  const nextMonth = new Date(d)
  nextMonth.setMonth(nextMonth.getMonth() + 1)
  
  // Si el día original no existe en el mes siguiente (ej: 31 en febrero),
  // JavaScript automáticamente ajusta al siguiente mes válido.
  // Verificamos y corregimos si es necesario.
  if (nextMonth.getDate() !== day) {
    // El día no existe en el mes siguiente, usar el último día del mes
    nextMonth.setDate(0) // Esto va al último día del mes anterior (que es el mes que queremos)
  }
  
  return nextMonth
}

/**
 * Calcula la fecha de vencimiento y retorna en formato YYYY-MM-DD
 */
export function calculateDueDate(paymentDate: string): string {
  const dueDate = getNextMonthDate(paymentDate)
  return dueDate.toISOString().split("T")[0]
}

/**
 * Un día se considera cerrado cuando open_time === close_time.
 * La convención usada en el código es "00:00:00" === "00:00:00", pero
 * cualquier valor donde open === close cuenta. null/null no es "cerrado"
 * (sin definir).
 */
export function isDayClosed(openTime: string | null, closeTime: string | null): boolean {
  if (!openTime || !closeTime) return false
  return openTime === closeTime
}

export const BS_PAYMENT_METHODS: readonly string[] = ["Pago Movil", "Efectivo bs", "Transferencia BS"]

/**
 * Convierte un monto al equivalente en USD.
 * Métodos en Bs requieren payment_rate (Bs/USD); sin tasa devuelve 0.
 * Métodos en USD/USDT devuelven el monto tal cual.
 */
export function toUsd(
  amount: number,
  method: string | null | undefined,
  rate: number | null | undefined,
): number {
  if (!amount || amount <= 0) return 0
  if (method && BS_PAYMENT_METHODS.includes(method)) {
    if (!rate || rate <= 0) return 0
    return amount / rate
  }
  return amount
}

/**
 * Calcula edad en años redondeados desde una fecha de nacimiento (string ISO YYYY-MM-DD).
 * Devuelve null si la fecha es inválida o futura.
 */
export function calculateAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null
  const date = new Date(birthDate + "T00:00:00")
  if (Number.isNaN(date.getTime())) return null
  const years = differenceInYears(new Date(), date)
  if (years < 0 || years > 120) return null
  return years
}
