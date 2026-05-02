"use client"

import ReactMarkdown from "react-markdown"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface RoutinePreviewModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  routine: { name: string; content: string } | null
  context?: string
}

export function RoutinePreviewModal({ open, onOpenChange, routine, context }: RoutinePreviewModalProps) {
  if (!routine) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{routine.name}</DialogTitle>
          {context && <DialogDescription>{context}</DialogDescription>}
        </DialogHeader>

        <div className="prose prose-invert prose-sm max-w-none border rounded-md p-4 min-h-[200px] bg-muted/30">
          {routine.content?.trim() ? (
            <ReactMarkdown>{routine.content}</ReactMarkdown>
          ) : (
            <p className="text-muted-foreground text-sm m-0">Esta rutina aún no tiene contenido.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
