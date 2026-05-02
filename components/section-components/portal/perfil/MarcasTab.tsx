"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Loader2, Pencil } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getMyRecords, type PersonalRecord } from "@/lib/actions/records"
import {
  FAMILY_LABEL,
  FAMILY_ORDER,
  calculateTotals,
  getMovementsByFamily,
  type MovementId,
} from "@/lib/constants/movements"
import { TotalsStrip } from "./totals-strip"
import { EditRecordModal } from "./edit-record-modal"

export function MarcasTab() {
  const [editingMovement, setEditingMovement] = useState<MovementId | null>(null)

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["my-records"],
    queryFn: getMyRecords,
    staleTime: 5 * 60 * 1000,
  })

  const recordsByMovement = useMemo(() => {
    const map: Record<string, PersonalRecord> = {}
    for (const r of records) map[r.movement] = r
    return map
  }, [records])

  const totals = useMemo(() => {
    const map: Record<string, number> = {}
    for (const r of records) map[r.movement] = Number(r.weight_kg)
    return calculateTotals(map)
  }, [records])

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const editingRecord = editingMovement ? recordsByMovement[editingMovement] : null

  return (
    <div className="space-y-5 sm:space-y-6">
      <TotalsStrip totals={totals} />

      <div className="space-y-3 sm:space-y-4">
        {FAMILY_ORDER.map((family) => {
          const movements = getMovementsByFamily(family)
          if (movements.length === 0) return null
          return (
            <Card key={family}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {FAMILY_LABEL[family]}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                <ul className="divide-y divide-border">
                  {movements.map((m) => {
                    const r = recordsByMovement[m.id]
                    const w = r ? Number(r.weight_kg) : null
                    return (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => setEditingMovement(m.id)}
                          className="w-full flex items-center justify-between gap-3 py-2.5 text-left hover:bg-muted/30 -mx-3 px-3 rounded transition-colors group"
                        >
                          <span className="text-sm truncate min-w-0 flex-1">{m.label}</span>
                          <span className="flex items-center gap-3 shrink-0">
                            {w !== null ? (
                              <>
                                <span className="text-sm font-semibold tabular-nums">
                                  {w.toLocaleString("es-VE")}
                                  <span className="text-xs font-normal text-muted-foreground ml-1">kg</span>
                                </span>
                                {r?.achieved_at && (
                                  <span className="text-[11px] text-muted-foreground hidden sm:inline">
                                    {format(new Date(r.achieved_at + "T00:00:00"), "d MMM yyyy", { locale: es })}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                            <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <EditRecordModal
        open={editingMovement !== null}
        onOpenChange={(open) => !open && setEditingMovement(null)}
        movement={editingMovement ?? "snatch"}
        currentWeight={editingRecord ? Number(editingRecord.weight_kg) : null}
        currentDate={editingRecord?.achieved_at ?? null}
      />
    </div>
  )
}
