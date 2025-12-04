"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"

interface RoleFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  role?: any
  allPermissions: Array<{ id: string; label: string; description: string }>
}

export function RoleFormModal({ open, onOpenChange, role, allPermissions }: RoleFormModalProps) {
  const [formData, setFormData] = useState({ name: "", description: "", permissions: [] as string[] })

  useEffect(() => {
    if (role) {
      setFormData({ name: role.name || "", description: role.description || "", permissions: role.permissions || [] })
    } else {
      setFormData({ name: "", description: "", permissions: [] })
    }
  }, [role, open])

  const handlePermissionToggle = (permissionId: string) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter((p) => p !== permissionId)
        : [...prev.permissions, permissionId],
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Guardando rol:", formData)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{role ? "Editar Rol" : "Crear Nuevo Rol"}</DialogTitle>
          <DialogDescription>{role ? "Modifica el rol y sus permisos asociados" : "Define un nuevo rol con permisos personalizados"}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-6 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre del rol</Label>
              <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Ej: Recepcionista" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Describe las responsabilidades de este rol" rows={3} />
            </div>
            <div className="grid gap-4">
              <Label>Permisos</Label>
              <div className="space-y-4 border rounded-lg p-4">
                {allPermissions.map((permission) => (
                  <div key={permission.id} className="flex items-start gap-3">
                    <Checkbox id={`perm-${permission.id}`} checked={formData.permissions.includes(permission.id)} onCheckedChange={() => handlePermissionToggle(permission.id)} className="mt-1" />
                    <div className="flex-1">
                      <label htmlFor={`perm-${permission.id}`} className="text-sm font-medium leading-none cursor-pointer">{permission.label}</label>
                      <p className="text-sm text-muted-foreground mt-1">{permission.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit">{role ? "Guardar cambios" : "Crear rol"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
