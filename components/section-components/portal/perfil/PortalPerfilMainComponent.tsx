"use client"

import { useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Camera, Loader2, Save, KeyRound } from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getMyProfile, updateMyProfile, uploadAvatarToCloudinary, updateAvatar } from "@/lib/actions/portal"

const schema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  phone: z.string().optional(),
  email: z.string().email("Email inválido"),
})
type FormData = z.infer<typeof schema>

export default function PortalPerfilMainComponent() {
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const { data: profile, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: getMyProfile,
    staleTime: 5 * 60 * 1000,
  })

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    values: {
      name: profile?.name ?? "",
      phone: profile?.phone ?? "",
      email: profile?.email ?? "",
    },
  })

  const updateMutation = useMutation({
    mutationFn: updateMyProfile,
    onSuccess: () => {
      toast.success("Perfil actualizado")
      queryClient.invalidateQueries({ queryKey: ["my-profile"] })
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Error al actualizar")
    },
  })

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      toast.error("La imagen no puede superar 2MB")
      return
    }

    // Preview local inmediato
    const reader = new FileReader()
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string)
    reader.readAsDataURL(file)

    setUploadingAvatar(true)
    try {
      const fd = new FormData()
      fd.append("avatar", file)
      const url = await uploadAvatarToCloudinary(fd)
      await updateAvatar(url)
      queryClient.invalidateQueries({ queryKey: ["my-profile"] })
      toast.success("Foto de perfil actualizada")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al subir imagen")
      setAvatarPreview(null)
    } finally {
      setUploadingAvatar(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const initials = profile?.name
    ? profile.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mi Perfil</h1>
        <p className="text-muted-foreground text-sm mt-1">Edita tus datos personales</p>
      </div>

      {/* Avatar */}
      <Card>
        <CardContent className="pt-6 flex flex-col items-center gap-4">
          <div className="relative">
            <Avatar className="h-24 w-24">
              <AvatarImage src={avatarPreview ?? profile?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-primary/20 text-primary text-xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 disabled:opacity-50"
            >
              {uploadingAvatar
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Camera className="h-4 w-4" />
              }
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleAvatarChange}
          />
          <p className="text-xs text-muted-foreground">JPG, PNG o WebP · Máx 2MB</p>
        </CardContent>
      </Card>

      {/* Data form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos personales</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={handleSubmit((d) => updateMutation.mutate(d))}
            className="space-y-4"
          >
            <div className="space-y-1">
              <Label htmlFor="name">Nombre completo</Label>
              <Input id="name" {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1">
              <Label htmlFor="phone">Teléfono</Label>
              <Input id="phone" type="tel" {...register("phone")} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              <p className="text-xs text-muted-foreground">
                Si cambias el email recibirás un correo de verificación.
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              Guardar cambios
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Change password */}
      <Card>
        <CardContent className="pt-6">
          <Link href="/portal/cambiar-contrasena">
            <Button variant="outline" className="w-full gap-2">
              <KeyRound className="h-4 w-4" />
              Cambiar contraseña
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
