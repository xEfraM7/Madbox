"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { DashboardLayout } from "@/components/shared/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Plus, MoreVertical, Edit, Trash2, Calendar, Clock, Loader2 } from "lucide-react"
import { ClassFormModal } from "./modals/class-form-modal"
import { SpecialPaymentModal } from "./modals/special-payment-modal"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { getSpecialClasses, deleteSpecialClass, getSpecialClassPayments } from "@/lib/actions/classes"

export default function ClassesMainComponent() {
  const queryClient = useQueryClient()
  const [isClassModalOpen, setIsClassModalOpen] = useState(false)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [selectedClass, setSelectedClass] = useState<any>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [classToDelete, setClassToDelete] = useState<any>(null)

  const { data: classes = [], isLoading: loadingClasses } = useQuery({
    queryKey: ["special-classes"],
    queryFn: getSpecialClasses,
  })

  const { data: payments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ["special-class-payments"],
    queryFn: getSpecialClassPayments,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSpecialClass(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["special-classes"] })
      toast.success("Clase eliminada", { description: `${classToDelete?.name} ha sido eliminada.` })
      setDeleteDialogOpen(false)
      setClassToDelete(null)
    },
    onError: () => {
      toast.error("Error", { description: "No se pudo eliminar la clase." })
    },
  })

  const formatDate = (date: string) => {
    if (!date) return "-"
    return new Date(date).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })
  }

  const parseSchedule = (schedule: string) => {
    if (!schedule) return { date: null, time: null }
    const match = schedule.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/)
    if (match) {
      const dateObj = new Date(match[1] + "T00:00:00")
      const formattedDate = dateObj.toLocaleDateString("es-ES", { 
        weekday: "short", 
        day: "numeric", 
        month: "short" 
      })
      return { 
        date: formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1),
        time: `${match[2]} - ${match[3]}`
      }
    }
    return { date: schedule, time: null }
  }

  const totalRevenue = payments.filter((p: any) => p.status === "paid").reduce((sum: number, p: any) => sum + Number(p.amount), 0)

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-balance">Clases Especiales</h1>
            <p className="text-muted-foreground mt-2">Gestiona clases adicionales y pagos independientes</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Clases</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{classes.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Ingresos por Clases</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-500">${totalRevenue.toFixed(2)}</div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Clases Programadas</h2>
              <p className="text-sm text-muted-foreground">Administra el calendario de clases especiales</p>
            </div>
            <Button onClick={() => { setSelectedClass(null); setIsClassModalOpen(true) }}>
              <Plus className="mr-2 h-4 w-4" />Crear Clase
            </Button>
          </div>

          {loadingClasses ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : classes.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No hay clases registradas
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {classes.map((classItem: any) => (
                <Card key={classItem.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{classItem.name}</CardTitle>
                        <CardDescription className="mt-1">{classItem.instructor}</CardDescription>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setSelectedClass(classItem); setIsClassModalOpen(true) }}>
                            <Edit className="mr-2 h-4 w-4" />Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setClassToDelete(classItem); setDeleteDialogOpen(true) }} className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Precio</span>
                        <span className="font-semibold">${Number(classItem.price).toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Capacidad</span>
                        <span>{classItem.capacity} personas</span>
                      </div>
                      <div className="pt-2 border-t space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-yellow-500" />
                          <span>{parseSchedule(classItem.schedule).date || "-"}</span>
                        </div>
                        {parseSchedule(classItem.schedule).time && (
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-4 w-4 text-yellow-500" />
                            <span>{parseSchedule(classItem.schedule).time}</span>
                          </div>
                        )}
                      </div>
                      
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Pagos de Clases</h2>
              <p className="text-sm text-muted-foreground">Historial de pagos por clases especiales</p>
            </div>
            <Button onClick={() => setIsPaymentModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />Registrar Pago
            </Button>
          </div>

          <Card>
            <CardContent className="pt-6">
              {loadingPayments ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Clase</TableHead>
                        <TableHead>Monto</TableHead>
                        <TableHead>Método</TableHead>
                        <TableHead>Fecha</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No hay pagos registrados</TableCell>
                        </TableRow>
                      ) : (
                        payments.map((payment: any) => (
                          <TableRow key={payment.id}>
                            <TableCell className="font-medium">{payment.members?.name || "Sin cliente"}</TableCell>
                            <TableCell>{payment.special_classes?.name || "Sin clase"}</TableCell>
                            <TableCell className="font-medium">${Number(payment.amount).toFixed(2)}</TableCell>
                            <TableCell className="text-muted-foreground">{payment.method || "-"}</TableCell>
                            <TableCell className="text-muted-foreground">{formatDate(payment.payment_date)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ClassFormModal open={isClassModalOpen} onOpenChange={setIsClassModalOpen} classItem={selectedClass} />
      <SpecialPaymentModal open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen} />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Eliminar clase"
        description={`¿Estás seguro de que deseas eliminar "${classToDelete?.name}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
        onConfirm={() => deleteMutation.mutate(classToDelete?.id)}
        isLoading={deleteMutation.isPending}
      />
    </DashboardLayout>
  )
}
