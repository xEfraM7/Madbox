"use client"

import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Plus, X } from "lucide-react"
import { showToast } from "@/lib/sweetalert"
import { isDayClosed } from "@/lib/utils"
import { updateGymSchedule } from "@/lib/actions/settings"
import { usePermissions } from "@/lib/hooks/use-permissions"

interface ScheduleInlineProps {
  id: string
  open_time: string | null
  close_time: string | null
  afternoon_open: string | null
  afternoon_close: string | null
}

function toShort(t: string | null): string {
  if (!t) return ""
  return t.slice(0, 5)
}

function toFull(t: string): string | null {
  if (!t) return null
  return `${t}:00`
}

// ─── 12h time helpers (sin AM/PM toggle, period implícito) ────

type Period = "AM" | "PM"

/** Parsea "HH:MM" 24h a hora 12h (1-12) y minutos. */
function parse24To12(value: string): { hour: string; minute: string } {
  if (!value) return { hour: "", minute: "" }
  const [hStr = "", mStr = ""] = value.split(":")
  const h = parseInt(hStr, 10)
  const m = parseInt(mStr, 10)
  if (isNaN(h) || isNaN(m)) return { hour: "", minute: "" }
  let h12: number
  if (h === 0) h12 = 12             // 00:00 (medianoche) → 12 (raro pero lo soportamos)
  else if (h <= 12) h12 = h         // 1-12 → mismo número (12 en mañana = mediodía)
  else h12 = h - 12                 // 13-23 → 1-11 PM
  return { hour: String(h12), minute: String(m).padStart(2, "0") }
}

/** Formatea (hora 1-12, minuto, period) a "HH:MM" 24h.
 *  Convención: "12" siempre = mediodía (12:00) en cualquier sección.
 *  En AM (mañana): h12=12 → 12:00 (noon); h12 1-11 → 01:00-11:00.
 *  En PM (tarde): h12=12 → 12:00 (noon); h12 1-11 → 13:00-23:00.
 */
function format12To24(h12: number, minute: number, period: Period): string {
  let h: number
  if (h12 === 12) h = 12                          // 12 siempre = noon
  else h = period === "AM" ? h12 : h12 + 12       // 1-11 según período
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

function formatLabel12(value: string | null): string {
  if (!value) return "—"
  const { hour, minute } = parse24To12(value.slice(0, 5))
  if (!hour || !minute) return "—"
  const [hStr] = value.split(":")
  const h = parseInt(hStr, 10)
  const period: Period = h < 12 || h === 24 ? "AM" : "PM"
  return `${hour}:${minute} ${period}`
}

function Time12h({
  value,
  period,
  onCommit,
  disabled,
}: {
  value: string
  period: Period
  onCommit: (next: string) => void
  disabled?: boolean
}) {
  const init = parse24To12(value)
  const [hour, setHour] = useState(init.hour)
  const [minute, setMinute] = useState(init.minute)

  useEffect(() => {
    const p = parse24To12(value)
    setHour(p.hour)
    setMinute(p.minute)
  }, [value])

  const commit = (h: string, m: string) => {
    const hn = parseInt(h, 10)
    const mn = parseInt(m, 10)
    if (isNaN(hn) || isNaN(mn) || hn < 1 || hn > 12 || mn < 0 || mn > 59) return
    onCommit(format12To24(hn, mn, period))
  }

  return (
    <div className="inline-flex items-center gap-0.5">
      <input
        type="number"
        inputMode="numeric"
        min={1}
        max={12}
        placeholder="hh"
        value={hour}
        onChange={(e) => setHour(e.target.value.replace(/\D/g, "").slice(0, 2))}
        onBlur={() => commit(hour, minute)}
        disabled={disabled}
        className="w-9 h-7 px-1 text-center text-xs bg-background border border-input rounded outline-none focus:ring-1 focus:ring-ring [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]"
      />
      <span className="text-xs text-muted-foreground">:</span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={59}
        placeholder="mm"
        value={minute}
        onChange={(e) => setMinute(e.target.value.replace(/\D/g, "").slice(0, 2))}
        onBlur={() => {
          const padded = minute && minute.length === 1 ? minute.padStart(2, "0") : minute
          if (padded !== minute) setMinute(padded)
          commit(hour, padded)
        }}
        disabled={disabled}
        className="w-9 h-7 px-1 text-center text-xs bg-background border border-input rounded outline-none focus:ring-1 focus:ring-ring [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]"
      />
      <span className="text-[10px] text-muted-foreground font-medium pl-0.5">{period}</span>
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────

export function ScheduleInline({
  id,
  open_time,
  close_time,
  afternoon_open,
  afternoon_close,
}: ScheduleInlineProps) {
  const queryClient = useQueryClient()
  const { hasPermission } = usePermissions()
  const canEdit = hasPermission("schedule.edit")

  const [openVal, setOpenVal] = useState(toShort(open_time))
  const [closeVal, setCloseVal] = useState(toShort(close_time))
  const [pmOpenVal, setPmOpenVal] = useState(toShort(afternoon_open))
  const [pmCloseVal, setPmCloseVal] = useState(toShort(afternoon_close))
  const [closed, setClosed] = useState(isDayClosed(open_time, close_time))
  const [showPm, setShowPm] = useState(Boolean(afternoon_open && afternoon_close))

  useEffect(() => {
    setOpenVal(toShort(open_time))
    setCloseVal(toShort(close_time))
    setPmOpenVal(toShort(afternoon_open))
    setPmCloseVal(toShort(afternoon_close))
    setClosed(isDayClosed(open_time, close_time))
    setShowPm(Boolean(afternoon_open && afternoon_close))
  }, [open_time, close_time, afternoon_open, afternoon_close])

  const mutation = useMutation({
    mutationFn: (data: {
      open_time: string
      close_time: string
      afternoon_open: string | null
      afternoon_close: string | null
    }) => updateGymSchedule(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gym-schedule"] })
      showToast.success("Horario actualizado", "Los cambios se guardaron.")
    },
    onError: () => showToast.error("Error", "No se pudo actualizar el horario."),
  })

  const persistMorning = (open: string, close: string) => {
    if (!open || !close) return
    mutation.mutate({
      open_time: `${open}:00`,
      close_time: `${close}:00`,
      afternoon_open: toFull(pmOpenVal),
      afternoon_close: toFull(pmCloseVal),
    })
  }

  const persistAfternoon = (pmOpen: string, pmClose: string) => {
    if (!openVal || !closeVal) return
    mutation.mutate({
      open_time: `${openVal}:00`,
      close_time: `${closeVal}:00`,
      afternoon_open: pmOpen ? `${pmOpen}:00` : null,
      afternoon_close: pmClose ? `${pmClose}:00` : null,
    })
  }

  const handleToggleClosed = (next: boolean) => {
    setClosed(next)
    if (next) {
      mutation.mutate({
        open_time: "00:00:00",
        close_time: "00:00:00",
        afternoon_open: null,
        afternoon_close: null,
      })
      setOpenVal("00:00")
      setCloseVal("00:00")
      setPmOpenVal("")
      setPmCloseVal("")
      setShowPm(false)
    } else {
      setOpenVal("")
      setCloseVal("")
    }
  }

  const handleRemoveAfternoon = () => {
    setShowPm(false)
    setPmOpenVal("")
    setPmCloseVal("")
    if (openVal && closeVal) {
      mutation.mutate({
        open_time: `${openVal}:00`,
        close_time: `${closeVal}:00`,
        afternoon_open: null,
        afternoon_close: null,
      })
    }
  }

  if (!canEdit) {
    if (closed) return <p className="text-xs text-muted-foreground">Cerrado</p>
    return (
      <div className="text-xs text-muted-foreground space-y-0.5">
        <p>{formatLabel12(openVal)} → {formatLabel12(closeVal)}</p>
        {pmOpenVal && pmCloseVal && (
          <p>{formatLabel12(pmOpenVal)} → {formatLabel12(pmCloseVal)}</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Switch checked={closed} onCheckedChange={handleToggleClosed} id={`closed-${id}`} />
        <Label htmlFor={`closed-${id}`} className="text-xs">Cerrado</Label>
      </div>
      {!closed && (
        <>
          <div className="space-y-1">
            <span className="text-[10px] uppercase text-muted-foreground tracking-wide">Mañana</span>
            <div className="grid grid-cols-[auto_1fr] gap-x-1.5 gap-y-1 items-center">
              <span className="text-[10px] text-muted-foreground">Abre</span>
              <Time12h
                value={openVal}
                period="AM"
                onCommit={(next) => {
                  setOpenVal(next)
                  persistMorning(next, closeVal)
                }}
                disabled={mutation.isPending}
              />
              <span className="text-[10px] text-muted-foreground">Cierra</span>
              <Time12h
                value={closeVal}
                period="AM"
                onCommit={(next) => {
                  setCloseVal(next)
                  persistMorning(openVal, next)
                }}
                disabled={mutation.isPending}
              />
            </div>
          </div>
          {showPm ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase text-muted-foreground tracking-wide">Tarde</span>
                <button
                  type="button"
                  onClick={handleRemoveAfternoon}
                  className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-0.5"
                  disabled={mutation.isPending}
                >
                  <X className="h-2.5 w-2.5" /> Quitar
                </button>
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-x-1.5 gap-y-1 items-center">
                <span className="text-[10px] text-muted-foreground">Abre</span>
                <Time12h
                  value={pmOpenVal}
                  period="PM"
                  onCommit={(next) => {
                    setPmOpenVal(next)
                    persistAfternoon(next, pmCloseVal)
                  }}
                  disabled={mutation.isPending}
                />
                <span className="text-[10px] text-muted-foreground">Cierra</span>
                <Time12h
                  value={pmCloseVal}
                  period="PM"
                  onCommit={(next) => {
                    setPmCloseVal(next)
                    persistAfternoon(pmOpenVal, next)
                  }}
                  disabled={mutation.isPending}
                />
              </div>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowPm(true)}
              className="h-7 text-[11px] px-2 gap-1 w-full justify-start text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-3 w-3" /> Agregar turno tarde
            </Button>
          )}
        </>
      )}
    </div>
  )
}
