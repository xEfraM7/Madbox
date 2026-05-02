"use client"

import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Plus, X } from "lucide-react"
import { showToast } from "@/lib/sweetalert"
import { updateGymSchedule } from "@/lib/actions/settings"
import { usePermissions } from "@/lib/hooks/use-permissions"

interface ScheduleInlineProps {
  id: string
  open_time: string | null
  close_time: string | null
  afternoon_open: string | null
  afternoon_close: string | null
}

function isClosed(open: string | null, close: string | null) {
  if (!open || !close) return false
  return open === close
}

function toShort(t: string | null): string {
  if (!t) return ""
  return t.slice(0, 5)
}

function toFull(t: string): string | null {
  if (!t) return null
  return `${t}:00`
}

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
  const [closed, setClosed] = useState(isClosed(open_time, close_time))
  const [showPm, setShowPm] = useState(Boolean(afternoon_open && afternoon_close))

  useEffect(() => {
    setOpenVal(toShort(open_time))
    setCloseVal(toShort(close_time))
    setPmOpenVal(toShort(afternoon_open))
    setPmCloseVal(toShort(afternoon_close))
    setClosed(isClosed(open_time, close_time))
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
        <p>{openVal || "—"} → {closeVal || "—"}</p>
        {pmOpenVal && pmCloseVal && (
          <p>{pmOpenVal} → {pmCloseVal}</p>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Switch checked={closed} onCheckedChange={handleToggleClosed} id={`closed-${id}`} />
        <Label htmlFor={`closed-${id}`} className="text-xs">Cerrado</Label>
      </div>
      {!closed && (
        <>
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase text-muted-foreground tracking-wide">Mañana</span>
            <div className="flex items-center gap-1">
              <Input
                type="time"
                value={openVal}
                onChange={(e) => setOpenVal(e.target.value)}
                onBlur={(e) => persistMorning(e.target.value, closeVal)}
                className="scheme-dark h-8 px-1.5 text-xs"
                disabled={mutation.isPending}
              />
              <span className="text-xs text-muted-foreground">→</span>
              <Input
                type="time"
                value={closeVal}
                onChange={(e) => setCloseVal(e.target.value)}
                onBlur={(e) => persistMorning(openVal, e.target.value)}
                className="scheme-dark h-8 px-1.5 text-xs"
                disabled={mutation.isPending}
              />
            </div>
          </div>
          {showPm ? (
            <div className="space-y-0.5">
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
              <div className="flex items-center gap-1">
                <Input
                  type="time"
                  value={pmOpenVal}
                  onChange={(e) => setPmOpenVal(e.target.value)}
                  onBlur={(e) => persistAfternoon(e.target.value, pmCloseVal)}
                  className="scheme-dark h-8 px-1.5 text-xs"
                  disabled={mutation.isPending}
                />
                <span className="text-xs text-muted-foreground">→</span>
                <Input
                  type="time"
                  value={pmCloseVal}
                  onChange={(e) => setPmCloseVal(e.target.value)}
                  onBlur={(e) => persistAfternoon(pmOpenVal, e.target.value)}
                  className="scheme-dark h-8 px-1.5 text-xs"
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
