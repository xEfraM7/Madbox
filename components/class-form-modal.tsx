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

interface ClassFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  classItem?: any
}

export function ClassFormModal({ open, onOpenChange, classItem }: ClassFormModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    instructor: "",
    price: "",
    capacity: "",
    schedule: "",
    description: "",
  })

  useEffect(() => {
    if (classItem) {
      setFormData({
        name: classItem.name || "",
        instructor: classItem.instructor || "",
        price: classItem.price?.toString() || "",
        capacity: classItem.capacity?.toString() || "",
        schedule: classItem.schedule || "",
        description: classItem.description || "",
      })
    } else {
      setFormData({
        name: "",
        instructor: "",
        price: "",
        capacity: "",
        schedule: "",
        description: "",
      })
    }
  }, [classItem, open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Guardando clase:", formData)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{classItem ? "Editar Clase" : "Crear Nueva Clase"}</DialogTitle>
          <DialogDescription>
            {classItem ? "Modifica los detalles de la clase" : "Programa una nueva clase especial"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre de la clase</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Yoga Avanzado"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="instructor">Instructor</Label>
              <Input
                id="instructor"
                value={formData.instructor}
                onChange={(e) => setFormData({ ...formData, instructor: e.target.value })}
                placeholder="Nombre del instructor"
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
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="capacity">Capacidad</Label>
                <Input
                  id="capacity"
                  type="number"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                  placeholder="20"
                  required
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="schedule">Horario</Label>
              <Input
                id="schedule"
                value={formData.schedule}
                onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                placeholder="Ej: Lunes 18:00 - 19:00"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Descripción (opcional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detalles adicionales sobre la clase"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">{classItem ? "Guardar cambios" : "Crear clase"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
