"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Swal from "sweetalert2"
import { showToast } from "@/lib/sweetalert"
import { DashboardLayout } from "@/components/shared/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Save, Building2, Loader2, KeyRound, Users, AlertTriangle } from "lucide-react"
import { getGymSettings, updateGymSettings } from "@/lib/actions/settings"
import { updatePassword } from "@/lib/actions/auth"
import { migrateMembersToPortal, migrateAdminMetadata } from "@/lib/actions/migration"

interface GymInfoForm {
  name: string
  email: string
  phone: string
  address: string
}

interface PasswordForm {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export default function SettingsMainComponent() {
  const queryClient = useQueryClient()
  const [migrating, setMigrating] = useState(false)
  const [migrateResult, setMigrateResult] = useState<{
    success: number; failed: number; errors: string[]
  } | null>(null)

  const handleMigration = async () => {
    const confirm = await Swal.fire({
      title: "¿Migrar miembros al portal?",
      html: "Se creará una cuenta de acceso para cada miembro que aún no tenga una.<br/>Contraseña inicial: <b>Madbox2026</b>",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sí, migrar",
      cancelButtonText: "Cancelar",
      background: "#0a0a0a",
      color: "#fff",
    })
    if (!confirm.isConfirmed) return

    setMigrating(true)
    try {
      await migrateAdminMetadata()
      const result = await migrateMembersToPortal()
      setMigrateResult(result)
      showToast.success("Migración completada", `${result.success} exitosos, ${result.failed} fallidos`)
    } catch (err) {
      showToast.error("Error en la migración", err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setMigrating(false)
    }
  }

  const { data: settings, isLoading: loadingSettings } = useQuery({
    queryKey: ["gym-settings"],
    queryFn: getGymSettings,
  })

  const { register, handleSubmit, reset } = useForm<GymInfoForm>({
    defaultValues: { name: "", email: "", phone: "", address: "" }
  })

  const { register: registerPassword, handleSubmit: handleSubmitPassword, reset: resetPassword, formState: { errors: passwordErrors } } = useForm<PasswordForm>({
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" }
  })

  useEffect(() => {
    if (settings) {
      reset({
        name: settings.name || "",
        email: settings.email || "",
        phone: settings.phone || "",
        address: settings.address || ""
      })
    }
  }, [settings, reset])

  const updateSettingsMutation = useMutation({
    mutationFn: (data: GymInfoForm) => updateGymSettings(settings?.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gym-settings"] })
      showToast.success("Configuración guardada", "Los datos del gimnasio han sido actualizados." )
    },
    onError: () => {
      showToast.error("Error", "No se pudo guardar la configuración." )
    },
  })

  const onSubmitGymInfo = (data: GymInfoForm) => {
    updateSettingsMutation.mutate(data)
  }

  const updatePasswordMutation = useMutation({
    mutationFn: (newPassword: string) => updatePassword(newPassword),
    onSuccess: () => {
      showToast.success("Contraseña actualizada", "Tu contraseña ha sido cambiada exitosamente." )
      resetPassword()
    },
    onError: (error: Error) => {
      showToast.error("Error", error.message || "No se pudo actualizar la contraseña." )
    },
  })

  const onSubmitPassword = (data: PasswordForm) => {
    if (data.newPassword !== data.confirmPassword) {
      showToast.error("Error", "Las contraseñas no coinciden." )
      return
    }
    if (data.newPassword.length < 6) {
      showToast.error("Error", "La contraseña debe tener al menos 6 caracteres." )
      return
    }
    updatePasswordMutation.mutate(data.newPassword)
  }

  if (loadingSettings) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-balance">Configuración</h1>
          <p className="text-muted-foreground mt-2">Administra los ajustes generales del sistema</p>
        </div>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="account">Cuenta</TabsTrigger>
            <TabsTrigger value="portal">Portal</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle>Información del Gimnasio</CardTitle>
                    <CardDescription>Datos generales de tu negocio</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit(onSubmitGymInfo)} className="space-y-4">
                  <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Nombre del gimnasio</Label>
                      <Input id="name" {...register("name")} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="email">Correo de contacto</Label>
                      <Input id="email" type="email" {...register("email")} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="phone">Teléfono</Label>
                      <Input id="phone" {...register("phone")} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="address">Dirección</Label>
                      <Input id="address" {...register("address")} />
                    </div>
                  </div>
                  <Button type="submit" disabled={updateSettingsMutation.isPending}>
                    {updateSettingsMutation.isPending ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</>
                    ) : (
                      <><Save className="mr-2 h-4 w-4" />Guardar cambios</>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="account">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <KeyRound className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle>Cambiar Contraseña</CardTitle>
                    <CardDescription>Actualiza tu contraseña de acceso</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmitPassword(onSubmitPassword)} className="space-y-4 max-w-md">
                  <div className="grid gap-2">
                    <Label htmlFor="newPassword">Nueva contraseña</Label>
                    <PasswordInput
                      id="newPassword"
                      placeholder="••••••••"
                      {...registerPassword("newPassword", { required: true, minLength: 6 })}
                    />
                    <p className="text-xs text-muted-foreground">Mínimo 6 caracteres</p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                    <PasswordInput
                      id="confirmPassword"
                      placeholder="••••••••"
                      {...registerPassword("confirmPassword", { required: true })}
                    />
                  </div>
                  <Button type="submit" disabled={updatePasswordMutation.isPending}>
                    {updatePasswordMutation.isPending ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Actualizando...</>
                    ) : (
                      <><KeyRound className="mr-2 h-4 w-4" />Cambiar contraseña</>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="portal" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Users className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle>Migración de miembros al portal</CardTitle>
                    <CardDescription>
                      Crea cuentas de acceso para todos los miembros registrados que aún no tienen una.
                      La contraseña inicial será <strong>Madbox2026</strong>.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={handleMigration}
                  disabled={migrating}
                  className="gap-2"
                >
                  {migrating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Users className="h-4 w-4" />
                  )}
                  {migrating ? "Migrando..." : "Migrar miembros al portal"}
                </Button>

                {migrateResult && (
                  <div className="rounded-lg border border-border p-4 space-y-2 text-sm">
                    <p className="text-green-400 font-medium">✓ {migrateResult.success} cuentas creadas</p>
                    {migrateResult.failed > 0 && (
                      <>
                        <p className="text-red-400 font-medium">✗ {migrateResult.failed} fallidos</p>
                        <ul className="text-muted-foreground space-y-1 pl-2">
                          {migrateResult.errors.map((e, i) => (
                            <li key={i} className="flex items-start gap-1">
                              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                              {e}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
