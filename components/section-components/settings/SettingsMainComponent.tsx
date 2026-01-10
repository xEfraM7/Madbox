"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { showToast } from "@/lib/sweetalert"
import { DashboardLayout } from "@/components/shared/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Save, Building2, Calendar, Loader2, KeyRound } from "lucide-react"
import { getGymSettings, updateGymSettings, getGymSchedule, updateGymSchedule } from "@/lib/actions/settings"
import { updatePassword } from "@/lib/actions/auth"

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

const dayOrder = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

export default function SettingsMainComponent() {
  const queryClient = useQueryClient()

  const { data: settings, isLoading: loadingSettings } = useQuery({
    queryKey: ["gym-settings"],
    queryFn: getGymSettings,
  })

  const { data: schedule = [], isLoading: loadingSchedule } = useQuery({
    queryKey: ["gym-schedule"],
    queryFn: getGymSchedule,
  })

  const sortedSchedule = [...schedule].sort((a: any, b: any) => 
    dayOrder.indexOf(a.day_of_week) - dayOrder.indexOf(b.day_of_week)
  )

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

  const updateScheduleMutation = useMutation({
    mutationFn: ({ id, open_time, close_time }: { id: string; open_time: string; close_time: string }) => 
      updateGymSchedule(id, { open_time, close_time }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gym-schedule"] })
      showToast.success("Horario actualizado", "El horario ha sido guardado." )
    },
    onError: () => {
      showToast.error("Error", "No se pudo actualizar el horario." )
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

  const handleScheduleChange = (id: string, field: "open_time" | "close_time", value: string) => {
    const daySchedule = schedule.find((s: any) => s.id === id)
    if (daySchedule) {
      updateScheduleMutation.mutate({
        id,
        open_time: field === "open_time" ? value : daySchedule.open_time,
        close_time: field === "close_time" ? value : daySchedule.close_time
      })
    }
  }

  if (loadingSettings || loadingSchedule) {
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
            <TabsTrigger value="schedule">Horarios</TabsTrigger>
            <TabsTrigger value="account">Cuenta</TabsTrigger>
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

          <TabsContent value="schedule">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle>Horarios del Gimnasio</CardTitle>
                    <CardDescription>Define los horarios de apertura</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="hidden sm:grid grid-cols-3 gap-4 text-sm font-medium text-muted-foreground">
                    <span>Día</span>
                    <span>Apertura</span>
                    <span>Cierre</span>
                  </div>
                  {sortedSchedule.map((day: any) => (
                    <div key={day.id} className="flex flex-col sm:grid sm:grid-cols-3 gap-2 sm:gap-4 sm:items-center p-3 sm:p-0 border sm:border-0 rounded-lg sm:rounded-none">
                      <Label className="font-medium">{day.day_of_week}</Label>
                      <div className="flex gap-2 sm:contents">
                        <div className="flex-1 sm:block">
                          <span className="text-xs text-muted-foreground sm:hidden">Abre: </span>
                          <Input 
                            type="time" 
                            defaultValue={day.open_time?.slice(0, 5)} 
                            className="scheme-dark"
                            onBlur={(e) => handleScheduleChange(day.id, "open_time", e.target.value)}
                          />
                        </div>
                        <div className="flex-1 sm:block">
                          <span className="text-xs text-muted-foreground sm:hidden">Cierra: </span>
                          <Input 
                            type="time" 
                            defaultValue={day.close_time?.slice(0, 5)} 
                            className="scheme-dark"
                            onBlur={(e) => handleScheduleChange(day.id, "close_time", e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
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
                    <Input 
                      id="newPassword" 
                      type="password" 
                      placeholder="••••••••"
                      {...registerPassword("newPassword", { required: true, minLength: 6 })} 
                    />
                    <p className="text-xs text-muted-foreground">Mínimo 6 caracteres</p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                    <Input 
                      id="confirmPassword" 
                      type="password" 
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
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
