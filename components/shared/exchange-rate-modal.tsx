"use client"

import { useState, useEffect } from "react"
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
  type: "BCV" | "USDT" | null
  currentRate: number
}

export function ExchangeRateModal({ open, onOpenChange, type, currentRate }: ExchangeRateModalProps) {
  const queryClient = useQueryClient()
  const [rate, setRate] = useState("")

  useEffect(() => {
    if (open && currentRate) {
      setRate(currentRate.toString())
    }
  }, [open, currentRate])

  const updateMutation = useMutation({
    mutationFn: ({ type, rate }: { type: string; rate: number }) => updateExchangeRate(type, rate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exchange-rates"] })
      queryClient.invalidateQueries({ queryKey: ["funds"] })
      toast.success("Tasa actualizada", {
        description: `La tasa ${type} ha sido actualizada a Bs. ${rate}`,
      })
      onOpenChange(false)
    },
    onError: () => {
      toast.error("Error", { description: "No se pudo actualizar la tasa." })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const rateValue = parseFloat(rate)
    if (isNaN(rateValue) || rateValue <= 0) {
      toast.error("Error", { description: "Ingresa una tasa válida mayor a 0" })
      return
    }
    if (!type) return
    updateMutation.mutate({ type, rate: rateValue })
  }

  const getTitle = () => {
    if (type === "BCV") return "Actualizar Tasa BCV"
    if (type === "USDT") return "Actualizar Tasa USDT"
    return "Actualizar Tasa"
  }

  const getDescription = () => {
    if (type === "BCV") return "Ingresa la tasa del Banco Central de Venezuela (Bs por $)"
    if (type === "USDT") return "Ingresa la tasa de USDT (Bs por USDT)"
    return ""
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
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
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  className="pl-10"
                  disabled={updateMutation.isPending}
                />
              </div>
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
