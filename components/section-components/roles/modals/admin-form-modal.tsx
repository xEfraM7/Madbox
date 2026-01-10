"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { showToast } from "@/lib/sweetalert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { createAdmin, updateAdmin, getAuthUsers } from "@/lib/actions/roles"

interface AdminFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  admin?: any
  roles: any[]
}

interface FormData {
  auth_user_id: string
  name: string
  email: string
  role_id: string
  status: string
}

export function AdminFormModal({ open, onOpenChange, admin, roles }: AdminFormModalProps) {
  const queryClient = useQueryClient()
  const isEditing = !!admin

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: { auth_user_id: "", name: "", email: "", role_id: "", status: "active" }
  })

  const auth_user_id = watch("auth_user_id")
  const role_id = watch("role_id")
  const status = watch("status")

  const { data: authUsers = [], isLoading: loadingUsers } = useQuery({
    queryKey: ["auth-users"],
    queryFn: getAuthUsers,
    enabled: open && !isEditing,
  })

  useEffect(() => {
    if (open) {
      if (admin) {
        reset({
          auth_user_id: admin.auth_user_id || "",
          name: admin.name || "",
          email: admin.email || "",
          role_id: admin.role_id || "",
          status: admin.status || "active"
        })
      } else {
        reset({ auth_user_id: "", name: "", email: "", role_id: "", status: "active" })
      }
    }
  }, [admin, open, reset])

  const handleUserSelect = (userId: string) => {
    setValue("auth_user_id", userId)
    const selectedUser = authUsers.find((u: any) => u.id === userId)
    if (selectedUser) {
      setValue("name", selectedUser.name)
      setValue("email", selectedUser.email)
    }
  }

  const createMutation = useMutation({
    mutationFn: (data: any) => createAdmin(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admins"] })
      queryClient.invalidateQueries({ queryKey: ["auth-users"] })
      showToast.success("Administrador creado", "El administrador ha sido registrado correctamente." )
      onOpenChange(false)
    },
    onError: () => showToast.error("Error", "No se pudo crear el administrador." ),
  })

  const updateMutation = useMutation({
    mutationFn: (data: any) => updateAdmin(admin.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admins"] })
      showToast.success("Administrador actualizado", "Los cambios han sido guardados." )
      onOpenChange(false)
    },
    onError: () => showToast.error("Error", "No se pudo actualizar el administrador." ),
  })

  const onSubmit = (data: FormData) => {
    const submitData = {
      auth_user_id: data.auth_user_id || null,
      name: data.name,
      email: data.email,
      role_id: data.role_id || null,
      status: data.status
    }

    if (admin) {
      updateMutation.mutate(submitData)
    } else {
      createMutation.mutate(submitData)
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{admin ? "Editar Administrador" : "Agregar Administrador"}</DialogTitle>
          <DialogDescription>
            {admin ? "Modifica la información del administrador" : "Selecciona un usuario registrado para asignarle permisos de administrador"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            {!isEditing && (
              <div className="grid gap-2">
                <Label>Usuario registrado</Label>
                {loadingUsers ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando usuarios...
                  </div>
                ) : authUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay usuarios disponibles para agregar como administrador</p>
                ) : (
                  <Select value={auth_user_id} onValueChange={handleUserSelect}>
                    <SelectTrigger><SelectValue placeholder="Selecciona un usuario" /></SelectTrigger>
                    <SelectContent>
                      {authUsers.map((user: any) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.name} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="name">Nombre completo</Label>
              <Input 
                id="name" 
                {...register("name", { required: "El nombre es requerido" })} 
                placeholder="Nombre del administrador"
                disabled={!isEditing && !auth_user_id}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input 
                id="email" 
                type="email" 
                {...register("email", { required: "El correo es requerido" })} 
                placeholder="correo@ejemplo.com"
                disabled={!isEditing}
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>

            <div className="grid gap-2">
              <Label>Rol</Label>
              <Select value={role_id} onValueChange={(value) => setValue("role_id", value)}>
                <SelectTrigger><SelectValue placeholder="Selecciona un rol" /></SelectTrigger>
                <SelectContent>
                  {roles.map((role: any) => (
                    <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Estado</Label>
              <Select value={status} onValueChange={(value) => setValue("status", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancelar</Button>
            <Button type="submit" disabled={isLoading || (!isEditing && !auth_user_id)}>
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : admin ? "Guardar cambios" : "Crear administrador"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
