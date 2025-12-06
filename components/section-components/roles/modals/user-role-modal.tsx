"use client"

import { useState, useEffect } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
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

export function UserRoleModal({ open, onOpenChange, user, roles }: UserRoleModalProps) {
  const queryClient = useQueryClient()
  const [selectedRoleId, setSelectedRoleId] = useState("")

  useEffect(() => {
    if (user?.role_id) {
      setSelectedRoleId(user.role_id)
    }
  }, [user])

  const updateMutation = useMutation({
    mutationFn: ({ id, roleId }: { id: string; roleId: string }) => 
      updateAdmin(id, { role_id: roleId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-admins"] })
      queryClient.invalidateQueries({ queryKey: ["admins"] })
      toast.success("Rol actualizado", {
        description: `Se ha actualizado el rol del usuario.`,
      })
      onOpenChange(false)
    },
    onError: (error: Error) => {
      toast.error("Error al actualizar rol", {
        description: error.message || "No se pudo actualizar el rol",
      })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRoleId) {
      toast.error("Selecciona un rol")
      return
    }
    if (!user?.id) {
      toast.error("Usuario no encontrado")
      return
    }
    updateMutation.mutate({ id: user.id, roleId: selectedRoleId })
  }

  const selectedRole = roles.find(r => r.id === selectedRoleId)

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
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="role">Rol</Label>
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
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
            <Button type="submit" disabled={updateMutation.isPending}>
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
