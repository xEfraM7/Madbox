"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { showToast } from "@/lib/sweetalert"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Mail, Loader2 } from "lucide-react"
import { sendInvitation } from "@/lib/actions/roles"

interface InviteModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface FormData {
  name: string
  email: string
}

export function InviteModal({ open, onOpenChange }: InviteModalProps) {
  const queryClient = useQueryClient()

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: { name: "", email: "" }
  })

  useEffect(() => {
    if (open) {
      reset({ name: "", email: "" })
    }
  }, [open, reset])

  const inviteMutation = useMutation({
    mutationFn: ({ email, name }: { email: string; name?: string }) => sendInvitation(email, name),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["all-auth-users"] })
      queryClient.invalidateQueries({ queryKey: ["admins"] })
      showToast.success("Invitación enviada", `Se ha enviado una invitación a ${variables.email}. Se le asignó el rol "Basica".`)
      onOpenChange(false)
    },
    onError: (error: Error) => {
      showToast.error("Error al enviar invitación", error.message || "No se pudo enviar la invitación",
      )
    },
  })

  const onSubmit = (data: FormData) => {
    inviteMutation.mutate({ email: data.email.trim(), name: data.name.trim() || undefined })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Enviar Invitación
          </DialogTitle>
          <DialogDescription>
            Envía una invitación para que un nuevo usuario acceda a la aplicación. Se le asignará automáticamente el rol "Basica".
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                type="text"
                placeholder="Juan Pérez"
                {...register("name")}
                disabled={inviteMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico *</Label>
              <Input
                id="email"
                type="email"
                placeholder="usuario@ejemplo.com"
                {...register("email", {
                  required: "El correo es requerido",
                  pattern: { value: /\S+@\S+\.\S+/, message: "Ingresa un correo válido" }
                })}
                disabled={inviteMutation.isPending}
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={inviteMutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={inviteMutation.isPending}>
              {inviteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Enviar Invitación
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
