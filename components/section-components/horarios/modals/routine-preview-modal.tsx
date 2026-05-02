"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { RoutineBlocks } from "@/components/shared/routine-blocks/RoutineBlocks"

interface RoutinePreviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  routine: { name: string; blocks: unknown } | null
  context?: string
}

export function RoutinePreviewModal({ open, onOpenChange, routine, context }: RoutinePreviewModalProps) {
  if (!routine) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{routine.name}</DialogTitle>
          {context && <DialogDescription>{context}</DialogDescription>}
        </DialogHeader>

        <div className="border rounded-md p-4 bg-muted/30">
          <RoutineBlocks blocks={routine.blocks} emptyMessage="Esta rutina aún no tiene contenido." />
        </div>
      </DialogContent>
    </Dialog>
  )
}
