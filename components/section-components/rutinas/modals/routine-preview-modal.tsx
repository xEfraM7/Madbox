"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import type { RoutineSchedule } from "@/lib/actions/routines"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  routine: RoutineSchedule | null
}

export function RoutinePreviewModal({ open, onOpenChange, routine }: Props) {
  if (!routine) return null

  const dateLabel = format(parseISO(routine.date + "T00:00:00"), "EEEE, d 'de' MMMM 'de' yyyy", {
    locale: es,
  })
  const dateLabelCap = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{routine.name?.trim() || "Rutina sin nombre"}</DialogTitle>
          <DialogDescription>{dateLabelCap}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-1.5">
          {routine.plans.map((p) => (
            <Badge key={p.id} variant="secondary" className="text-xs">
              {p.name}
            </Badge>
          ))}
        </div>
        <article className="prose prose-invert prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{routine.content}</ReactMarkdown>
        </article>
      </DialogContent>
    </Dialog>
  )
}
