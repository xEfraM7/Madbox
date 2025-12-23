"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import { updateExchangeRate } from "@/lib/actions/funds"

interface ExchangeRateModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: "BCV" | "USDT" | "CUSTOM" | null
  currentRate: number
}

interface FormData {
  rate: string
}

export function ExchangeRateModal({ open, onOpenChange, type, currentRate }: ExchangeRateModalProps) {
  const queryClient = useQueryClient()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: { rate: "" }
  })

  useEffect(() => {
    if (open && currentRate) {
      reset({ rate: currentRate.toString() })
    }
  }, [open, currentRate, reset])

  const updateMutation = useMutation({
    mutationFn: ({ type, rate }: { type: string; rate: number }) => updateExchangeRate(type, rate),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["exchange-rates"] })
      queryClient.invalidateQueries({ queryKey: ["funds"] })
      toast.success("Tasa actualizada", {
        description: `La tasa ${type} ha sido actualizada a Bs. ${variables.rate}`,
      })
      onOpenChange(false)
    },
    onError: () => {
      toast.error("Error", { description: "No se pudo actualizar la tasa." })
    },
  })

  const onSubmit = (data: FormData) => {
    const rateValue = parseFloat(data.rate)
    if (!type) return
    updateMutation.mutate({ type, rate: rateValue })
  }

  const getTitle = () => {
    if (type === "BCV") return "Actualizar Tasa BCV"
    if (type === "USDT") return "Actualizar Tasa USDT"
    if (type === "CUSTOM") return "Actualizar Tasa Personalizada"
    return "Actualizar Tasa"
  }

  const getDescription = () => {
    if (type === "BCV") return "Ingresa la tasa del Banco Central de Venezuela (Bs por $)"
    if (type === "USDT") return "Ingresa la tasa de USDT (Bs por USDT)"
    if (type === "CUSTOM") return "Ingresa tu tasa personalizada (Bs por $)"
    return ""
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rate">Tasa en Bolívares</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">Bs.</span>
                <Input
                  id="rate"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  {...register("rate", {
                    required: "La tasa es requerida",
                    validate: (value) => parseFloat(value) > 0 || "Ingresa una tasa válida mayor a 0"
                  })}
                  className="pl-10"
                  disabled={updateMutation.isPending}
                />
              </div>
              {errors.rate && <p className="text-sm text-destructive">{errors.rate.message}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={updateMutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
