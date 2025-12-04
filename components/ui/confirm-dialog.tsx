"use client"

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Trash2, Info, CheckCircle } from "lucide-react"

type DialogVariant = "danger" | "warning" | "info" | "success"

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: DialogVariant
  onConfirm: () => void
  isLoading?: boolean
}

const variantConfig = {
  danger: { icon: Trash2, iconClass: "text-destructive", buttonClass: "bg-destructive hover:bg-destructive/90 text-destructive-foreground" },
  warning: { icon: AlertTriangle, iconClass: "text-yellow-500", buttonClass: "bg-yellow-500 hover:bg-yellow-600 text-white" },
  info: { icon: Info, iconClass: "text-blue-500", buttonClass: "bg-blue-500 hover:bg-blue-600 text-white" },
  success: { icon: CheckCircle, iconClass: "text-green-500", buttonClass: "bg-green-500 hover:bg-green-600 text-white" },
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  variant = "danger",
  onConfirm,
  isLoading = false,
}: ConfirmDialogProps) {
  const config = variantConfig[variant]
  const Icon = config.icon

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0">
              <Icon className={`h-6 w-6 ${config.iconClass}`} />
            </div>
            <div>
              <DialogTitle className="text-left">{title}</DialogTitle>
              <DialogDescription className="text-left mt-1">{description}</DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            {cancelText}
          </Button>
          <Button 
            onClick={onConfirm} 
            disabled={isLoading} 
            className={config.buttonClass}
          >
            {isLoading ? "Procesando..." : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
