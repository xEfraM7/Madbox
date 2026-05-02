import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

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
