"use client"

import type React from "react"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"

interface PaymentFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  payment?: any
}

export function PaymentFormModal({ open, onOpenChange, payment }: PaymentFormModalProps) {
  const [formData, setFormData] = useState({
    user: "",
    amount: "",
    method: "",
    status: "paid",
  })
  const [date, setDate] = useState<Date | undefined>(new Date())

  useEffect(() => {
    if (payment) {
      setFormData({
        user: payment.user || "",
        amount: payment.amount?.toString() || "",
        method: payment.method || "",
        status: payment.status || "paid",
      })
    } else {
      setFormData({
        user: "",
        amount: "",
        method: "",
        status: "paid",
      })
      setDate(new Date())
    }
  }, [payment, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Registrando pago:", formData, date)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{payment ? "Editar Pago" : "Registrar Nuevo Pago"}</DialogTitle>
          <DialogDescription>
            {payment ? "Modifica la información del pago" : "Registra un nuevo pago de mensualidad"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="user">Usuario</Label>
              <Select value={formData.user} onValueChange={(value) => setFormData({ ...formData, user: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un usuario" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Carlos Rodríguez">Carlos Rodríguez</SelectItem>
                  <SelectItem value="María García">María García</SelectItem>
                  <SelectItem value="Juan López">Juan López</SelectItem>
                  <SelectItem value="Ana Martínez">Ana Martínez</SelectItem>
                  <SelectItem value="Pedro Sánchez">Pedro Sánchez</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="amount">Monto</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="method">Método de pago</Label>
                <Select value={formData.method} onValueChange={(value) => setFormData({ ...formData, method: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona método" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Efectivo">Efectivo</SelectItem>
                    <SelectItem value="Tarjeta">Tarjeta</SelectItem>
                    <SelectItem value="Transferencia">Transferencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Fecha de pago</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("justify-start text-left font-normal", !date && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP", { locale: es }) : "Selecciona una fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="status">Estado</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Pagado</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="overdue">Vencido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">{payment ? "Guardar cambios" : "Registrar pago"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
