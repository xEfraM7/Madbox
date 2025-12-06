"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
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

export function InviteModal({ open, onOpenChange }: InviteModalProps) {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")

  const inviteMutation = useMutation({
    mutationFn: ({ email, name }: { email: string; name?: string }) => sendInvitation(email, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-auth-users"] })
      queryClient.invalidateQueries({ queryKey: ["admins"] })
      toast.success("Invitación enviada", {
        description: `Se ha enviado una invitación a ${email}. Se le asignó el rol "Basica".`,
      })
      setEmail("")
      setName("")
      onOpenChange(false)
    },
    onError: (error: Error) => {
      toast.error("Error al enviar invitación", {
        description: error.message || "No se pudo enviar la invitación",
      })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      toast.error("El correo es requerido")
      return
    }
    inviteMutation.mutate({ email: email.trim(), name: name.trim() || undefined })
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
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                type="text"
                placeholder="Juan Pérez"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={inviteMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Correo electrónico *</Label>
              <Input
                id="email"
                type="email"
                placeholder="usuario@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={inviteMutation.isPending}
              />
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
