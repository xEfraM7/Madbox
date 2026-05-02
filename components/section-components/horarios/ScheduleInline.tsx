"use client"

import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Plus, X } from "lucide-react"
import { showToast } from "@/lib/sweetalert"
import { updateGymSchedule } from "@/lib/actions/settings"
import { usePermissions } from "@/lib/hooks/use-permissions"
import { isDayClosed } from "@/lib/utils"

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

// ─── 12h time input helpers ─────────────────────────────────

function parse24(value: string): { hour: string; minute: string; period: "AM" | "PM" } {
  if (!value) return { hour: "", minute: "", period: "AM" }
  const [hStr = "", mStr = ""] = value.split(":")
  const h = parseInt(hStr, 10)
  const m = parseInt(mStr, 10)
  if (isNaN(h) || isNaN(m)) return { hour: "", minute: "", period: "AM" }
  let h12: number
  let period: "AM" | "PM"
  if (h === 0) { h12 = 12; period = "AM" }
  else if (h < 12) { h12 = h; period = "AM" }
  else if (h === 12) { h12 = 12; period = "PM" }
  else { h12 = h - 12; period = "PM" }
  return { hour: String(h12), minute: String(m).padStart(2, "0"), period }
}

function format24(h12: number, minute: number, period: "AM" | "PM"): string {
  let h: number
  if (period === "AM") h = h12 === 12 ? 0 : h12
  else h = h12 === 12 ? 12 : h12 + 12
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

function formatLabel12(value: string | null): string {
  if (!value) return "—"
  const p = parse24(value.slice(0, 5))
  if (!p.hour || !p.minute) return "—"
  return `${p.hour}:${p.minute} ${p.period}`
}

function Time12h({
  value,
  onCommit,
  disabled,
}: {
  value: string
  onCommit: (next: string) => void
  disabled?: boolean
}) {
  const init = parse24(value)
  const [hour, setHour] = useState(init.hour)
  const [minute, setMinute] = useState(init.minute)
  const [period, setPeriod] = useState<"AM" | "PM">(init.period)

  useEffect(() => {
    const p = parse24(value)
    setHour(p.hour)
    setMinute(p.minute)
    setPeriod(p.period)
  }, [value])

  const commit = (h: string, m: string, p: "AM" | "PM") => {
    const hn = parseInt(h, 10)
    const mn = parseInt(m, 10)
    if (isNaN(hn) || isNaN(mn) || hn < 1 || hn > 12 || mn < 0 || mn > 59) return
    onCommit(format24(hn, mn, p))
  }

  const togglePeriod = () => {
    const next = period === "AM" ? "PM" : "AM"
    setPeriod(next)
    commit(hour, minute, next)
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
        onBlur={() => commit(hour, minute, period)}
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
          commit(hour, padded, period)
        }}
        disabled={disabled}
        className="w-9 h-7 px-1 text-center text-xs bg-background border border-input rounded outline-none focus:ring-1 focus:ring-ring [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]"
      />
      <button
        type="button"
        onClick={togglePeriod}
        disabled={disabled}
        className="h-7 px-1.5 text-[10px] font-semibold bg-muted hover:bg-muted/80 rounded border border-input transition-colors"
      >
        {period}
      </button>
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
                onCommit={(next) => {
                  setOpenVal(next)
                  persistMorning(next, closeVal)
                }}
                disabled={mutation.isPending}
              />
              <span className="text-[10px] text-muted-foreground">Cierra</span>
              <Time12h
                value={closeVal}
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
                  onCommit={(next) => {
                    setPmOpenVal(next)
                    persistAfternoon(next, pmCloseVal)
                  }}
                  disabled={mutation.isPending}
                />
                <span className="text-[10px] text-muted-foreground">Cierra</span>
                <Time12h
                  value={pmCloseVal}
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
