"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Trophy, Dumbbell, Layers, Activity } from "lucide-react"

interface TotalsStripProps {
  totals: { grand: number; olympic: number; squat: number; press: number }
}

const ITEMS: Array<{
  key: keyof TotalsStripProps["totals"]
  label: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}> = [
  { key: "grand",   label: "Grand Total",   icon: Trophy,   color: "text-primary" },
  { key: "olympic", label: "Olympic Total", icon: Dumbbell, color: "text-blue-400" },
  { key: "squat",   label: "Squat Total",   icon: Layers,   color: "text-green-400" },
  { key: "press",   label: "Press Total",   icon: Activity, color: "text-orange-400" },
]

export function TotalsStrip({ totals }: TotalsStripProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
      {ITEMS.map(({ key, label, icon: Icon, color }) => {
        const value = totals[key]
        return (
          <Card key={key}>
            <CardContent className="py-3 sm:py-4">
              <div className="flex items-center gap-2">
                <Icon className={`h-4 w-4 sm:h-5 sm:w-5 shrink-0 ${color}`} />
                <p className="text-[10px] sm:text-xs uppercase text-muted-foreground tracking-wide truncate">
                  {label}
                </p>
              </div>
              <p className="mt-1.5 sm:mt-2 text-lg sm:text-2xl font-bold tabular-nums">
                {value > 0 ? value.toLocaleString("es-VE") : "—"}
                {value > 0 && <span className="text-xs sm:text-sm font-normal text-muted-foreground ml-1">kg</span>}
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
