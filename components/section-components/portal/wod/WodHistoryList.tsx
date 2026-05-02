"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Loader2, Calendar } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getMyWodHistory, type WodLog } from "@/lib/actions/wod-logs"
import { WodLogRow } from "./WodLogRow"
import { LogWodModal } from "./log-wod-modal"

export function WodHistoryList() {
  const [editing, setEditing] = useState<WodLog | null>(null)

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["my-wod-history"],
    queryFn: () => getMyWodHistory(50, 0),
    staleTime: 60 * 1000,
  })

  const grouped = useMemo(() => {
    const map = new Map<string, WodLog[]>()
    for (const l of logs) {
      const key = l.date.slice(0, 7)
      const arr = map.get(key) ?? []
      arr.push(l)
      map.set(key, arr)
    }
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a))
  }, [logs])

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold uppercase tracking-wide">
              Mi historial
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-6 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Aún no has registrado ningún WOD.
            </p>
          ) : (
            <div className="space-y-4">
              {grouped.map(([month, items]) => {
                const label = format(new Date(month + "-01T00:00:00"), "MMMM yyyy", { locale: es })
                return (
                  <div key={month}>
                    <p className="text-[11px] font-semibold uppercase text-muted-foreground tracking-wide mb-1.5">
                      {label}
                    </p>
                    <ul className="divide-y divide-border">
                      {items.map((l) => (
                        <li key={l.id}>
                          <WodLogRow log={l} onClick={() => setEditing(l)} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <LogWodModal
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        existingLog={editing}
      />
    </>
  )
}
