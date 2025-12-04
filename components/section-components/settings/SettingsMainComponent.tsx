"use client"

import type React from "react"
import { useState } from "react"
import { DashboardLayout } from "@/components/shared/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Save, Building2, Bell, DollarSign, Calendar } from "lucide-react"

export default function SettingsMainComponent() {
  const [gymInfo, setGymInfo] = useState({ name: "FitGym Pro", email: "contacto@fitgym.com", phone: "+34 600 000 000", address: "Calle Principal 123, Madrid", description: "Tu gimnasio de confianza" })
  const [notifications, setNotifications] = useState({ emailPayments: true, emailNewUsers: true, smsReminders: false, paymentAlerts: true })
  const [paymentSettings, setPaymentSettings] = useState({ currency: "EUR", taxRate: "21", paymentMethods: ["Efectivo", "Tarjeta", "Transferencia"] })

  const handleSaveGymInfo = (e: React.FormEvent) => {
    e.preventDefault()
    console.log("Guardando información del gimnasio:", gymInfo)
  }

  const notificationItems = [
    { id: "emailPayments", label: "Notificaciones de pagos por email", description: "Recibe un correo cuando se registra un pago" },
    { id: "emailNewUsers", label: "Alertas de nuevos usuarios", description: "Notificación cuando se registra un nuevo miembro" },
    { id: "smsReminders", label: "Recordatorios por SMS", description: "Enviar recordatorios de pagos por SMS" },
    { id: "paymentAlerts", label: "Alertas de pagos vencidos", description: "Notificación cuando un pago está próximo a vencer" },
  ]

  const paymentMethods = ["Efectivo", "Tarjeta", "Transferencia", "PayPal"]
  const weekDays = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

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
            <TabsTrigger value="notifications">Notificaciones</TabsTrigger>
            <TabsTrigger value="payments">Pagos</TabsTrigger>
            <TabsTrigger value="schedule">Horarios</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-primary" />
                  <div><CardTitle>Información del Gimnasio</CardTitle><CardDescription>Datos generales de tu negocio</CardDescription></div>
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSaveGymInfo} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="name">Nombre del gimnasio</Label>
                      <Input id="name" value={gymInfo.name} onChange={(e) => setGymInfo({ ...gymInfo, name: e.target.value })} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="email">Correo de contacto</Label>
                      <Input id="email" type="email" value={gymInfo.email} onChange={(e) => setGymInfo({ ...gymInfo, email: e.target.value })} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="phone">Teléfono</Label>
                      <Input id="phone" value={gymInfo.phone} onChange={(e) => setGymInfo({ ...gymInfo, phone: e.target.value })} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="address">Dirección</Label>
                      <Input id="address" value={gymInfo.address} onChange={(e) => setGymInfo({ ...gymInfo, address: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">Descripción</Label>
                    <Textarea id="description" value={gymInfo.description} onChange={(e) => setGymInfo({ ...gymInfo, description: e.target.value })} rows={3} />
                  </div>
                  <Button type="submit"><Save className="mr-2 h-4 w-4" />Guardar cambios</Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Bell className="h-5 w-5 text-primary" />
                  <div><CardTitle>Preferencias de Notificaciones</CardTitle><CardDescription>Configura alertas y recordatorios</CardDescription></div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  {notificationItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor={item.id}>{item.label}</Label>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                      <Switch id={item.id} checked={notifications[item.id as keyof typeof notifications]} onCheckedChange={(checked) => setNotifications({ ...notifications, [item.id]: checked })} />
                    </div>
                  ))}
                </div>
                <Button><Save className="mr-2 h-4 w-4" />Guardar preferencias</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-primary" />
                  <div><CardTitle>Configuración de Pagos</CardTitle><CardDescription>Métodos de pago e impuestos</CardDescription></div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="currency">Moneda</Label>
                    <Input id="currency" value={paymentSettings.currency} readOnly />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="taxRate">Tasa de impuesto (%)</Label>
                    <Input id="taxRate" type="number" value={paymentSettings.taxRate} onChange={(e) => setPaymentSettings({ ...paymentSettings, taxRate: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Métodos de pago habilitados</Label>
                  <div className="space-y-2">
                    {paymentMethods.map((method) => (
                      <div key={method} className="flex items-center gap-2">
                        <Switch id={method} checked={paymentSettings.paymentMethods.includes(method)} />
                        <Label htmlFor={method}>{method}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <Button><Save className="mr-2 h-4 w-4" />Guardar configuración</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="schedule">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-primary" />
                  <div><CardTitle>Horarios del Gimnasio</CardTitle><CardDescription>Define los horarios de apertura</CardDescription></div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {weekDays.map((day) => (
                    <div key={day} className="grid grid-cols-3 gap-4 items-center">
                      <Label>{day}</Label>
                      <Input type="time" defaultValue="06:00" />
                      <Input type="time" defaultValue="22:00" />
                    </div>
                  ))}
                </div>
                <Button><Save className="mr-2 h-4 w-4" />Guardar horarios</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
