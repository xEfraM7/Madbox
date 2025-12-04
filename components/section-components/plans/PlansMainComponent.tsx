"use client"

import { useState } from "react"
import { DashboardLayout } from "@/components/shared/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Plus, MoreVertical, Edit, Trash2, Check } from "lucide-react"
import { PlanFormModal } from "./modals/plan-form-modal"

const plansData = [
  { id: 1, name: "Plan Básico", price: 29.99, duration: "Mensual", features: ["Acceso al gimnasio", "Vestuarios", "Duchas"], active: true },
  { id: 2, name: "Plan Premium", price: 49.99, duration: "Mensual", features: ["Todo lo del básico", "Clases grupales", "Asesoría nutricional"], active: true },
  { id: 3, name: "Plan Anual", price: 299.99, duration: "Anual", features: ["Plan Premium", "2 meses gratis", "Entrenador personal 1x/mes"], active: true },
  { id: 4, name: "Plan Estudiante", price: 19.99, duration: "Mensual", features: ["Acceso básico", "Horario limitado", "Requiere credencial"], active: false },
]

export default function PlansMainComponent() {
  const [plans, setPlans] = useState(plansData)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<any>(null)

  const handleDelete = (planId: number) => {
    if (confirm("¿Estás seguro de que deseas eliminar este plan?")) {
      setPlans(plans.filter((p) => p.id !== planId))
    }
  }

  const PlanActions = ({ plan }: { plan: typeof plansData[0] }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => { setSelectedPlan(plan); setIsModalOpen(true) }}><Edit className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleDelete(plan.id)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Eliminar</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-balance">Planes de Mensualidad</h1>
            <p className="text-muted-foreground mt-2">Gestiona los planes y precios del gimnasio</p>
          </div>
          <Button onClick={() => { setSelectedPlan(null); setIsModalOpen(true) }}>
            <Plus className="mr-2 h-4 w-4" />
            Crear Plan
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id} className={!plan.active ? "opacity-60" : ""}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <CardDescription className="mt-1">{plan.duration}</CardDescription>
                  </div>
                  <PlanActions plan={plan} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <span className="text-4xl font-bold">${plan.price}</span>
                    <span className="text-muted-foreground">/{plan.duration === "Mensual" ? "mes" : "año"}</span>
                  </div>
                  <div className="space-y-2">
                    {plan.features.map((feature, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>
                  <Badge variant={plan.active ? "default" : "secondary"}>{plan.active ? "Activo" : "Inactivo"}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista Completa de Planes</CardTitle>
            <CardDescription>Vista detallada en formato tabla</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Precio</TableHead>
                    <TableHead>Duración</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell className="font-medium">{plan.name}</TableCell>
                      <TableCell>${plan.price}</TableCell>
                      <TableCell>{plan.duration}</TableCell>
                      <TableCell><Badge variant={plan.active ? "default" : "secondary"}>{plan.active ? "Activo" : "Inactivo"}</Badge></TableCell>
                      <TableCell className="text-right"><PlanActions plan={plan} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <PlanFormModal open={isModalOpen} onOpenChange={setIsModalOpen} plan={selectedPlan} />
    </DashboardLayout>
  )
}
