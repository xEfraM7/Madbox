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
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

interface PlanFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  plan?: any
}

export function PlanFormModal({ open, onOpenChange, plan }: PlanFormModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    duration: "Mensual",
    features: "",
    active: true,
  })

  useEffect(() => {
    if (plan) {
      setFormData({
        name: plan.name || "",
        price: plan.price?.toString() || "",
        duration: plan.duration || "Mensual",
        features: plan.features?.join("\n") || "",
        active: plan.active ?? true,
      })
    } else {
      setFormData({
        name: "",
        price: "",
        duration: "Mensual",
        features: "",
        active: true,
      })
    }
  }, [plan, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Guardando plan:", formData)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{plan ? "Editar Plan" : "Crear Nuevo Plan"}</DialogTitle>
          <DialogDescription>
            {plan ? "Modifica los detalles del plan" : "Define un nuevo plan de mensualidad"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre del plan</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Plan Premium"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="price">Precio</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="29.99"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="duration">Duración</Label>
                <Select
                  value={formData.duration}
                  onValueChange={(value) => setFormData({ ...formData, duration: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona duración" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mensual">Mensual</SelectItem>
                    <SelectItem value="Trimestral">Trimestral</SelectItem>
                    <SelectItem value="Semestral">Semestral</SelectItem>
                    <SelectItem value="Anual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="features">Características (una por línea)</Label>
              <Textarea
                id="features"
                value={formData.features}
                onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                placeholder="Acceso al gimnasio&#10;Clases grupales&#10;Asesoría nutricional"
                rows={5}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="active">Plan activo</Label>
              <Switch
                id="active"
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">{plan ? "Guardar cambios" : "Crear plan"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
