"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { showToast } from "@/lib/sweetalert"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Shield, Loader2 } from "lucide-react"
import { updateAdmin } from "@/lib/actions/roles"

interface UserRoleModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: any
  roles: any[]
}

interface FormData {
  role_id: string
}

export function UserRoleModal({ open, onOpenChange, user, roles }: UserRoleModalProps) {
  const queryClient = useQueryClient()

  const { handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: { role_id: "" }
  })

  const roleId = watch("role_id")
  const selectedRole = roles.find(r => r.id === roleId)

  useEffect(() => {
    if (open && user?.role_id) {
      reset({ role_id: user.role_id })
    }
  }, [open, user, reset])

  const updateMutation = useMutation({
    mutationFn: ({ id, roleId }: { id: string; roleId: string }) => 
      updateAdmin(id, { role_id: roleId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-admins"] })
      queryClient.invalidateQueries({ queryKey: ["admins"] })
      showToast.success("Rol actualizado", `Se ha actualizado el rol del usuario.`,
      )
      onOpenChange(false)
    },
    onError: (error: Error) => {
      showToast.error("Error al actualizar rol", error.message || "No se pudo actualizar el rol",
      )
    },
  })

  const onSubmit = (data: FormData) => {
    if (!user?.id) {
      showToast.error("Usuario no encontrado")
      return
    }
    updateMutation.mutate({ id: user.id, roleId: data.role_id })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Cambiar Rol de Usuario
          </DialogTitle>
          <DialogDescription>
            Cambia el rol y permisos de <span className="font-medium">{user?.email}</span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="role">Rol</Label>
              <Select value={roleId} onValueChange={(value) => setValue("role_id", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un rol" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.role_id && <p className="text-sm text-destructive">{errors.role_id.message}</p>}
            </div>
            {selectedRole && (
              <div className="rounded-md bg-muted p-3">
                <p className="text-sm font-medium mb-1">{selectedRole.name}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedRole.description || "Sin descripción"}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={updateMutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={updateMutation.isPending || !roleId}>
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                "Guardar Cambios"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
