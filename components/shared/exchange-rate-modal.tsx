"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { showToast } from "@/lib/sweetalert"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, RefreshCw } from "lucide-react"
import { updateExchangeRate } from "@/lib/actions/funds"
import { syncBCVRate, syncUSDTRate } from "@/lib/actions/binance"

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

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormData>({
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
      showToast.success("Tasa actualizada", `La tasa ${type} ha sido actualizada a Bs. ${variables.rate}`)
      onOpenChange(false)
    },
    onError: () => {
      showToast.error("Error", "No se pudo actualizar la tasa.")
    },
  })

  const syncBCVMutation = useMutation({
    mutationFn: syncBCVRate,
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["exchange-rates"] })
        queryClient.invalidateQueries({ queryKey: ["funds"] })
        setValue("rate", result.rate.toString())
        showToast.success("Tasa BCV sincronizada", `Nueva tasa BCV: Bs. ${result.rate}`)
      } else {
        showToast.error("Error al sincronizar", result.error || "No se pudo obtener la tasa BCV")
      }
    },
    onError: () => {
      showToast.error("Error de conexión", "No se pudo conectar con DolarAPI")
    },
  })

  const syncUSDTMutation = useMutation({
    mutationFn: syncUSDTRate,
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["exchange-rates"] })
        queryClient.invalidateQueries({ queryKey: ["funds"] })
        setValue("rate", result.rate.toString())
        showToast.success("Tasa paralela sincronizada", `Nueva tasa USDT: Bs. ${result.rate}`)
      } else {
        showToast.error("Error al sincronizar", result.error || "No se pudo obtener la tasa paralela")
      }
    },
    onError: () => {
      showToast.error("Error de conexión", "No se pudo conectar con DolarAPI")
    },
  })

  const onSubmit = (data: FormData) => {
    const rateValue = parseFloat(data.rate)
    if (!type) return
    updateMutation.mutate({ type, rate: rateValue })
  }

  const handleSync = () => {
    if (type === "BCV") {
      syncBCVMutation.mutate()
    } else if (type === "USDT") {
      syncUSDTMutation.mutate()
    }
  }

  const getTitle = () => {
    if (type === "BCV") return "Actualizar Tasa BCV"
    if (type === "USDT") return "Actualizar Tasa USDT"
    if (type === "CUSTOM") return "Actualizar Tasa Personalizada"
    return "Actualizar Tasa"
  }

  const getDescription = () => {
    if (type === "BCV") return "Ingresa la tasa BCV (Bs por $) o sincroniza desde DolarAPI"
    if (type === "USDT") return "Ingresa la tasa paralela (Bs por USDT) o sincroniza desde DolarAPI"
    if (type === "CUSTOM") return "Ingresa tu tasa personalizada (Bs por $)"
    return ""
  }

  const isSyncing = syncBCVMutation.isPending || syncUSDTMutation.isPending
  const isPending = updateMutation.isPending || isSyncing
  const canSync = type === "BCV" || type === "USDT"

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
              <div className="flex gap-2">
                <div className="relative flex-1">
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
                    disabled={isPending}
                  />
                </div>
                {canSync && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleSync}
                    disabled={isPending}
                    title={`Sincronizar ${type === "BCV" ? "tasa oficial" : "tasa paralela"} desde DolarAPI`}
                  >
                    {isSyncing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
              {errors.rate && <p className="text-sm text-destructive">{errors.rate.message}</p>}
              {canSync && (
                <p className="text-xs text-muted-foreground">
                  Haz clic en el botón de sincronizar para obtener la tasa actual desde DolarAPI
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
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

