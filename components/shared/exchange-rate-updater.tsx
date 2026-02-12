"use client"

import { useEffect } from "react"
import { checkAndSyncRates } from "@/lib/actions/binance"
import { showToast } from "@/lib/sweetalert"
import { useQueryClient } from "@tanstack/react-query"

/**
 * Componente "invisible" que verifica y actualiza las tasas de cambio
 * si han pasado más de 1 hora desde la última actualización.
 */
export function ExchangeRateUpdater() {
    const queryClient = useQueryClient()

    useEffect(() => {
        const checkRates = async () => {
            try {
                const result = await checkAndSyncRates()

                if (result.updated) {
                    // Invalidar queries para actualizar la UI
                    queryClient.invalidateQueries({ queryKey: ["exchange-rates"] })
                    queryClient.invalidateQueries({ queryKey: ["funds"] })

                    // Notificar al usuario (opcional, pero útil)
                    showToast.info(
                        "Tasas Actualizadas",
                        "Se han sincronizado las tasas de cambio automáticamente."
                    )
                }
            } catch (error) {
                console.error("Error en ExchangeRateUpdater:", error)
            }
        }

        // Ejecutar al montar
        checkRates()

        // Opcional: Ejecutar cada 1 hora si el usuario mantiene la pestaña abierta
        const interval = setInterval(checkRates, 3600 * 1000)

        return () => clearInterval(interval)
    }, [queryClient])

    return null // Este componente no renderiza nada
}
