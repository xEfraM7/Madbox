"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Loader2, Save, Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { upsertRecord, deleteRecord } from "@/lib/actions/records"
import type { MovementId } from "@/lib/constants/movements"
import { getMovement } from "@/lib/constants/movements"

const schema = z.object({
  weight_kg: z.coerce.number().positive("Debe ser mayor a 0").max(500, "Máximo 500 kg"),
  achieved_at: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface EditRecordModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  movement: MovementId
  currentWeight: number | null
  currentDate: string | null
}

export function EditRecordModal({
  open,
  onOpenChange,
  movement,
  currentWeight,
  currentDate,
}: EditRecordModalProps) {
  const queryClient = useQueryClient()
  const movementInfo = getMovement(movement)

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      weight_kg: currentWeight ?? undefined,
      achieved_at: currentDate ?? "",
    },
  })

  useEffect(() => {
    if (open) {
      reset({
        weight_kg: currentWeight ?? undefined,
        achieved_at: currentDate ?? "",
      })
    }
  }, [open, currentWeight, currentDate, reset])

  const upsertMutation = useMutation({
    mutationFn: (data: FormData) =>
      upsertRecord({
        movement,
        weight_kg: data.weight_kg,
        achieved_at: data.achieved_at && data.achieved_at.length > 0 ? data.achieved_at : null,
      }),
    onSuccess: () => {
      toast.success(`PR actualizado: ${movementInfo.label}`)
      queryClient.invalidateQueries({ queryKey: ["my-records"] })
      onOpenChange(false)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Error al guardar")
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteRecord(movement),
    onSuccess: () => {
      toast.success(`PR borrado: ${movementInfo.label}`)
      queryClient.invalidateQueries({ queryKey: ["my-records"] })
      onOpenChange(false)
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Error al borrar")
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{movementInfo.label}</DialogTitle>
          <DialogDescription>
            Registra tu mejor marca personal en este movimiento.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit((d) => upsertMutation.mutate(d))} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="weight_kg" className="text-sm">Peso (kg)</Label>
            <Input
              id="weight_kg"
              type="number"
              step="0.5"
              min={0.5}
              max={500}
              placeholder="Ej: 100"
              {...register("weight_kg")}
            />
            {errors.weight_kg && (
              <p className="text-xs text-destructive">{errors.weight_kg.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="achieved_at" className="text-sm">
              Fecha (opcional)
            </Label>
            <Input
              id="achieved_at"
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              className="scheme-dark"
              {...register("achieved_at")}
            />
          </div>
          <DialogFooter className="gap-2 flex-col sm:flex-row">
            {currentWeight !== null && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending || upsertMutation.isPending}
                className="gap-2 text-destructive hover:text-destructive sm:mr-auto"
              >
                {deleteMutation.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Trash2 className="h-4 w-4" />
                }
                Borrar PR
              </Button>
            )}
            <Button
              type="submit"
              disabled={upsertMutation.isPending || deleteMutation.isPending}
              className="gap-2"
            >
              {upsertMutation.isPending
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Save className="h-4 w-4" />
              }
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
