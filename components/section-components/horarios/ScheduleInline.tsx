"use client"

import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { showToast } from "@/lib/sweetalert"
import { updateGymSchedule } from "@/lib/actions/settings"
import { usePermissions } from "@/lib/hooks/use-permissions"

interface ScheduleInlineProps {
  id: string
  open_time: string | null
  close_time: string | null
}

function isClosed(open: string | null, close: string | null) {
  if (!open || !close) return false
  return open === close
}

function toShort(t: string | null): string {
  if (!t) return ""
  return t.slice(0, 5)
}

export function ScheduleInline({ id, open_time, close_time }: ScheduleInlineProps) {
  const queryClient = useQueryClient()
  const { hasPermission } = usePermissions()
  const canEdit = hasPermission("schedule.edit")

  const [openVal, setOpenVal] = useState(toShort(open_time))
  const [closeVal, setCloseVal] = useState(toShort(close_time))
  const [closed, setClosed] = useState(isClosed(open_time, close_time))

  useEffect(() => {
    setOpenVal(toShort(open_time))
    setCloseVal(toShort(close_time))
    setClosed(isClosed(open_time, close_time))
  }, [open_time, close_time])

  const mutation = useMutation({
    mutationFn: (data: { open_time: string; close_time: string }) => updateGymSchedule(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gym-schedule"] })
      showToast.success("Horario actualizado", "Los cambios se guardaron.")
    },
    onError: () => showToast.error("Error", "No se pudo actualizar el horario."),
  })

  const persist = (open: string, close: string) => {
    if (!open || !close) return
    mutation.mutate({ open_time: `${open}:00`, close_time: `${close}:00` })
  }

  const handleToggleClosed = (next: boolean) => {
    setClosed(next)
    if (next) {
      mutation.mutate({ open_time: "00:00:00", close_time: "00:00:00" })
      setOpenVal("00:00")
      setCloseVal("00:00")
    } else {
      setOpenVal("")
      setCloseVal("")
    }
  }

  if (!canEdit) {
    if (closed) return <p className="text-xs text-muted-foreground">Cerrado</p>
    return (
      <p className="text-xs text-muted-foreground">
        {openVal || "—"} → {closeVal || "—"}
      </p>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Switch checked={closed} onCheckedChange={handleToggleClosed} id={`closed-${id}`} />
        <Label htmlFor={`closed-${id}`} className="text-xs">Cerrado</Label>
      </div>
      {!closed && (
        <div className="flex items-center gap-1">
          <Input
            type="time"
            value={openVal}
            onChange={(e) => setOpenVal(e.target.value)}
            onBlur={(e) => persist(e.target.value, closeVal)}
            className="scheme-dark h-8 px-1.5 text-xs"
            disabled={mutation.isPending}
          />
          <span className="text-xs text-muted-foreground">→</span>
          <Input
            type="time"
            value={closeVal}
            onChange={(e) => setCloseVal(e.target.value)}
            onBlur={(e) => persist(openVal, e.target.value)}
            className="scheme-dark h-8 px-1.5 text-xs"
            disabled={mutation.isPending}
          />
        </div>
      )}
    </div>
  )
}
