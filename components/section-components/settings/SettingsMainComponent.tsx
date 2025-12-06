"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { DashboardLayout } from "@/components/shared/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Save, Building2, Calendar, Loader2 } from "lucide-react"
import { getGymSettings, updateGymSettings, getGymSchedule, updateGymSchedule } from "@/lib/actions/settings"

interface GymInfoForm {
  name: string
  email: string
  phone: string
  address: string
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
      toast.success("Configuración guardada", { description: "Los datos del gimnasio han sido actualizados." })
    },
    onError: () => {
      toast.error("Error", { description: "No se pudo guardar la configuración." })
    },
  })

  const updateScheduleMutation = useMutation({
    mutationFn: ({ id, open_time, close_time }: { id: string; open_time: string; close_time: string }) => 
      updateGymSchedule(id, { open_time, close_time }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gym-schedule"] })
      toast.success("Horario actualizado", { description: "El horario ha sido guardado." })
    },
    onError: () => {
      toast.error("Error", { description: "No se pudo actualizar el horario." })
    },
  })

  const onSubmitGymInfo = (data: GymInfoForm) => {
    updateSettingsMutation.mutate(data)
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
                  <div className="grid gap-4 md:grid-cols-2">
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
                  <div className="grid grid-cols-3 gap-4 text-sm font-medium text-muted-foreground">
                    <span>Día</span>
                    <span>Apertura</span>
                    <span>Cierre</span>
                  </div>
                  {sortedSchedule.map((day: any) => (
                    <div key={day.id} className="grid grid-cols-3 gap-4 items-center">
                      <Label>{day.day_of_week}</Label>
                      <Input 
                        type="time" 
                        defaultValue={day.open_time?.slice(0, 5)} 
                        className="[color-scheme:dark]"
                        onBlur={(e) => handleScheduleChange(day.id, "open_time", e.target.value)}
                      />
                      <Input 
                        type="time" 
                        defaultValue={day.close_time?.slice(0, 5)} 
                        className="[color-scheme:dark]"
                        onBlur={(e) => handleScheduleChange(day.id, "close_time", e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
