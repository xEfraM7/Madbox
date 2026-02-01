"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Calendar, ChevronRight } from "lucide-react"
import type { PendingPeriod } from "@/types/database"

interface PendingClosingsBannerProps {
    pendingPeriods: PendingPeriod[]
    onClosePeriod: (period: string) => void
}

export function PendingClosingsBanner({ pendingPeriods, onClosePeriod }: PendingClosingsBannerProps) {
    if (pendingPeriods.length === 0) {
        return null
    }

    const oldestPeriod = pendingPeriods.find(p => p.isOldest) || pendingPeriods[0]
    const count = pendingPeriods.length

    return (
        <Alert className="border-orange-500/50 bg-orange-500/10 relative">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            <AlertTitle className="text-orange-500 font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {count === 1
                    ? "Tienes 1 mes pendiente por cerrar"
                    : `Tienes ${count} meses pendientes por cerrar`
                }
            </AlertTitle>
            <AlertDescription className="mt-2">
                <div className="space-y-3">
                    {count === 1 ? (
                        <p className="text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">{oldestPeriod.label}</span> aún no ha sido cerrado.
                            Los datos del mes ya están disponibles para consolidar.
                        </p>
                    ) : (
                        <div className="text-sm">
                            <p className="text-muted-foreground mb-2">Los siguientes meses no han sido cerrados:</p>
                            <ul className="space-y-1">
                                {pendingPeriods.slice(0, 3).map((period) => (
                                    <li key={period.period} className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                                        <span className={period.isOldest ? "font-medium" : ""}>{period.label}</span>
                                        {period.isOldest && <span className="text-xs text-orange-500">(más antiguo)</span>}
                                    </li>
                                ))}
                                {count > 3 && (
                                    <li className="text-muted-foreground text-xs">
                                        ...y {count - 3} más
                                    </li>
                                )}
                            </ul>
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2 pt-1">
                        <Button
                            size="sm"
                            onClick={() => onClosePeriod(oldestPeriod.period)}
                            className="gap-1"
                        >
                            Cerrar {oldestPeriod.label}
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </AlertDescription>
        </Alert>
    )
}
