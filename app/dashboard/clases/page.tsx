"use client"

import { useState } from "react"
import { DashboardLayout } from "@/components/shared/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Plus, MoreVertical, Edit, Trash2, Calendar } from "lucide-react"
import { ClassFormModal } from "@/components/section-components/classes/modals/class-form-modal"
import { SpecialPaymentModal } from "@/components/section-components/classes/modals/special-payment-modal"

const classesData = [
  {
    id: 1,
    name: "Yoga Avanzado",
    instructor: "Ana Martínez",
    price: 15.0,
    capacity: 20,
    schedule: "Lunes 18:00 - 19:00",
    enrolled: 18,
  },
  {
    id: 2,
    name: "CrossFit Intensivo",
    instructor: "Carlos López",
    price: 25.0,
    capacity: 15,
    schedule: "Miércoles 19:00 - 20:30",
    enrolled: 15,
  },
  {
    id: 3,
    name: "Spinning",
    instructor: "Laura Pérez",
    price: 12.0,
    capacity: 25,
    schedule: "Viernes 17:00 - 18:00",
    enrolled: 22,
  },
]

const specialPaymentsData = [
  {
    id: 1,
    user: "María García",
    class: "Yoga Avanzado",
    amount: 15.0,
    date: "20/03/2024",
    status: "paid",
  },
  {
    id: 2,
    user: "Juan López",
    class: "CrossFit Intensivo",
    amount: 25.0,
    date: "22/03/2024",
    status: "pending",
  },
  {
    id: 3,
    user: "Pedro Sánchez",
    class: "Spinning",
    amount: 12.0,
    date: "23/03/2024",
    status: "paid",
  },
]

export default function ClassesPage() {
  const [classes, setClasses] = useState(classesData)
  const [specialPayments, setSpecialPayments] = useState(specialPaymentsData)
  const [isClassModalOpen, setIsClassModalOpen] = useState(false)
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false)
  const [selectedClass, setSelectedClass] = useState<any>(null)

  const handleDeleteClass = (classId: number) => {
    if (confirm("¿Estás seguro de que deseas eliminar esta clase?")) {
      setClasses(classes.filter((c) => c.id !== classId))
    }
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      paid: { variant: "default" as const, label: "Pagado" },
      pending: { variant: "secondary" as const, label: "Pendiente" },
    }
    const config = variants[status as keyof typeof variants]
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-balance">Clases Especiales</h1>
          <p className="text-muted-foreground mt-2">Gestiona clases adicionales y pagos independientes</p>
        </div>

        {/* Sección de clases programadas */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Clases Programadas</h2>
              <p className="text-sm text-muted-foreground">Administra el calendario de clases especiales</p>
            </div>
            <Button
              onClick={() => {
                setSelectedClass(null)
                setIsClassModalOpen(true)
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Crear Clase
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {classes.map((classItem) => (
              <Card key={classItem.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{classItem.name}</CardTitle>
                      <CardDescription className="mt-1">{classItem.instructor}</CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedClass(classItem)
                            setIsClassModalOpen(true)
                          }}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDeleteClass(classItem.id)} className="text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Precio</span>
                      <span className="font-semibold">${classItem.price}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Capacidad</span>
                      <span>
                        {classItem.enrolled}/{classItem.capacity}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">{classItem.schedule}</span>
                    </div>
                    <Badge variant={classItem.enrolled >= classItem.capacity ? "destructive" : "default"}>
                      {classItem.enrolled >= classItem.capacity ? "Completo" : "Disponible"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Sección de pagos independientes */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold">Pagos Independientes</h2>
              <p className="text-sm text-muted-foreground">Historial de pagos por clases especiales</p>
            </div>
            <Button onClick={() => setIsPaymentModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Registrar Pago
            </Button>
          </div>

          <Card>
            <CardContent className="pt-6">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuario</TableHead>
                      <TableHead>Clase</TableHead>
                      <TableHead>Monto</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {specialPayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium">{payment.user}</TableCell>
                        <TableCell>{payment.class}</TableCell>
                        <TableCell className="font-medium">${payment.amount}</TableCell>
                        <TableCell className="text-muted-foreground">{payment.date}</TableCell>
                        <TableCell>{getStatusBadge(payment.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <ClassFormModal open={isClassModalOpen} onOpenChange={setIsClassModalOpen} classItem={selectedClass} />

      <SpecialPaymentModal open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen} />
    </DashboardLayout>
  )
}


