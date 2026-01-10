"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { showToast } from "@/lib/sweetalert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2 } from "lucide-react"
import { createRole, updateRole } from "@/lib/actions/roles"
import { permissionGroups } from "../RolesMainComponent"

interface RoleFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  role?: any
}

interface FormData {
  name: string
  description: string
  permissions: string[]
}

export function RoleFormModal({ open, onOpenChange, role }: RoleFormModalProps) {
  const queryClient = useQueryClient()
  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: { name: "", description: "", permissions: [] }
  })

  const permissions = watch("permissions")

  useEffect(() => {
    if (open) {
      if (role) {
        reset({
          name: role.name || "",
          description: role.description || "",
          permissions: role.permissions || []
        })
      } else {
        reset({ name: "", description: "", permissions: [] })
      }
    }
  }, [role, open, reset])

  const togglePermission = (permissionId: string) => {
    const current = permissions || []
    if (current.includes(permissionId)) {
      setValue("permissions", current.filter((p) => p !== permissionId))
    } else {
      setValue("permissions", [...current, permissionId])
    }
  }

  const createMutation = useMutation({
    mutationFn: (data: any) => createRole(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] })
      showToast.success("Rol creado", "El rol ha sido creado correctamente." )
      onOpenChange(false)
    },
    onError: () => showToast.error("Error", "No se pudo crear el rol." ),
  })

  const updateMutation = useMutation({
    mutationFn: (data: any) => updateRole(role.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] })
      showToast.success("Rol actualizado", "Los cambios han sido guardados." )
      onOpenChange(false)
    },
    onError: () => showToast.error("Error", "No se pudo actualizar el rol." ),
  })

  const onSubmit = (data: FormData) => {
    if (role) {
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(data)
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{role ? "Editar Rol" : "Crear Nuevo Rol"}</DialogTitle>
          <DialogDescription>{role ? "Modifica los permisos del rol" : "Define un nuevo rol con permisos personalizados"}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre del rol</Label>
              <Input id="name" {...register("name", { required: "El nombre es requerido" })} placeholder="Ej: Recepcionista" />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Descripción</Label>
              <Input id="description" {...register("description")} placeholder="Descripción del rol" />
            </div>
            <div className="grid gap-2">
              <Label>Permisos</Label>
              <div className="border rounded-md p-4 space-y-4 max-h-[300px] overflow-y-auto">
                {permissionGroups.map((group) => (
                  <div key={group.id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`group-${group.id}`}
                        checked={group.permissions.every(p => (permissions || []).includes(p.id))}
                        onCheckedChange={(checked) => {
                          const groupPermIds = group.permissions.map(p => p.id)
                          if (checked) {
                            const newPerms = [...new Set([...(permissions || []), ...groupPermIds])]
                            setValue("permissions", newPerms)
                          } else {
                            setValue("permissions", (permissions || []).filter(p => !groupPermIds.includes(p)))
                          }
                        }}
                      />
                      <label htmlFor={`group-${group.id}`} className="text-sm font-semibold cursor-pointer">{group.label}</label>
                    </div>
                    <div className="ml-6 space-y-1.5">
                      {group.permissions.map((permission) => (
                        <div key={permission.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`perm-${permission.id}`}
                            checked={(permissions || []).includes(permission.id)}
                            onCheckedChange={() => togglePermission(permission.id)}
                          />
                          <label htmlFor={`perm-${permission.id}`} className="text-sm cursor-pointer">{permission.label}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancelar</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : role ? "Guardar cambios" : "Crear rol"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
