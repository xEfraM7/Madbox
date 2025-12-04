"use client"

import type React from "react"
import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface SpecialPaymentModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SpecialPaymentModal({ open, onOpenChange }: SpecialPaymentModalProps) {
  const [formData, setFormData] = useState({ user: "", class: "", amount: "", method: "" })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Registrando pago especial:", formData)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Registrar Pago de Clase Especial</DialogTitle>
          <DialogDescription>Registra un pago individual por una clase especial o evento</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="user">Usuario</Label>
              <Select value={formData.user} onValueChange={(value) => setFormData({ ...formData, user: value })}>
                <SelectTrigger><SelectValue placeholder="Selecciona un usuario" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Carlos Rodríguez">Carlos Rodríguez</SelectItem>
                  <SelectItem value="María García">María García</SelectItem>
                  <SelectItem value="Juan López">Juan López</SelectItem>
                  <SelectItem value="Ana Martínez">Ana Martínez</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="class">Clase/Evento</Label>
              <Select value={formData.class} onValueChange={(value) => setFormData({ ...formData, class: value })}>
                <SelectTrigger><SelectValue placeholder="Selecciona una clase" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Yoga Avanzado">Yoga Avanzado</SelectItem>
                  <SelectItem value="CrossFit Intensivo">CrossFit Intensivo</SelectItem>
                  <SelectItem value="Spinning">Spinning</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="amount">Monto</Label>
                <Input id="amount" type="number" step="0.01" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} placeholder="0.00" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="method">Método de pago</Label>
                <Select value={formData.method} onValueChange={(value) => setFormData({ ...formData, method: value })}>
                  <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Efectivo">Efectivo</SelectItem>
                    <SelectItem value="Tarjeta">Tarjeta</SelectItem>
                    <SelectItem value="Transferencia">Transferencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit">Registrar pago</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
