"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { showToast } from "@/lib/sweetalert"
import { DashboardLayout } from "@/components/shared/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Plus, MoreVertical, Edit, Trash2, Check, Loader2, ToggleLeft, ToggleRight } from "lucide-react"
import { PlanFormModal } from "./modals/plan-form-modal"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { getPlans, deletePlan, updatePlan } from "@/lib/actions/plans"

export default function PlansMainComponent() {
  const queryClient = useQueryClient()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<any>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [toggleDialogOpen, setToggleDialogOpen] = useState(false)
  const [planToAction, setPlanToAction] = useState<any>(null)

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["plans"],
    queryFn: getPlans,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePlan(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] })
      showToast.success("Plan eliminado", `${planToAction?.name} ha sido eliminado correctamente.`)
      setDeleteDialogOpen(false)
      setPlanToAction(null)
    },
    onError: () => {
      showToast.error("Error al eliminar", "No se pudo eliminar el plan. Puede que tenga miembros asociados.")
    },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => updatePlan(id, { active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] })
      const action = planToAction?.active ? "desactivado" : "activado"
      showToast.success(`Plan ${action}`, `${planToAction?.name} ha sido ${action}.`)
      setToggleDialogOpen(false)
      setPlanToAction(null)
    },
    onError: () => {
      showToast.error("Error", "No se pudo cambiar el estado del plan.")
    },
  })

  const PlanActions = ({ plan }: { plan: any }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => { setSelectedPlan(plan); setIsModalOpen(true) }}><Edit className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
        <DropdownMenuItem onClick={() => { setPlanToAction(plan); setToggleDialogOpen(true) }}>
          {plan.active ? <ToggleLeft className="mr-2 h-4 w-4" /> : <ToggleRight className="mr-2 h-4 w-4" />}
          {plan.active ? "Desactivar" : "Activar"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => { setPlanToAction(plan); setDeleteDialogOpen(true) }} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Eliminar</DropdownMenuItem>
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

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {plans.map((plan: any) => (
                <Card key={plan.id} className={!plan.active ? "opacity-60" : ""}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-xl">{plan.name}</CardTitle>
                        <CardDescription className="mt-1">Mensual</CardDescription>
                      </div>
                      <PlanActions plan={plan} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <span className="text-4xl font-bold">${Number(plan.price).toFixed(2)}</span>
                        <span className="text-muted-foreground">/mes</span>
                      </div>
                      <div className="space-y-2">
                        {(plan.features || []).map((feature: string, index: number) => (
                          <div key={index} className="flex items-start gap-2">
                            <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                            <span className="text-sm">{feature}</span>
                          </div>
                        ))}
                        {(!plan.features || plan.features.length === 0) && (
                          <p className="text-sm text-muted-foreground">Sin características definidas</p>
                        )}
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
                        <TableHead className="hidden sm:table-cell">Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {plans.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">No hay planes registrados</TableCell>
                        </TableRow>
                      ) : (
                        plans.map((plan: any) => (
                          <TableRow key={plan.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{plan.name}</p>
                                <Badge variant={plan.active ? "default" : "secondary"} className="sm:hidden text-xs mt-1">{plan.active ? "Activo" : "Inactivo"}</Badge>
                              </div>
                            </TableCell>
                            <TableCell>${Number(plan.price).toFixed(2)}</TableCell>
                            <TableCell className="hidden sm:table-cell"><Badge variant={plan.active ? "default" : "secondary"}>{plan.active ? "Activo" : "Inactivo"}</Badge></TableCell>
                            <TableCell className="text-right"><PlanActions plan={plan} /></TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <PlanFormModal open={isModalOpen} onOpenChange={setIsModalOpen} plan={selectedPlan} />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Eliminar plan"
        description={`¿Estás seguro de que deseas eliminar "${planToAction?.name}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
        onConfirm={() => deleteMutation.mutate(planToAction?.id)}
        isLoading={deleteMutation.isPending}
      />

      <ConfirmDialog
        open={toggleDialogOpen}
        onOpenChange={setToggleDialogOpen}
        title={planToAction?.active ? "Desactivar plan" : "Activar plan"}
        description={planToAction?.active
          ? `¿Deseas desactivar "${planToAction?.name}"? Los clientes no podrán seleccionar este plan.`
          : `¿Deseas activar "${planToAction?.name}"? El plan estará disponible para nuevos clientes.`
        }
        confirmText={planToAction?.active ? "Desactivar" : "Activar"}
        variant={planToAction?.active ? "warning" : "success"}
        onConfirm={() => toggleMutation.mutate({ id: planToAction?.id, active: !planToAction?.active })}
        isLoading={toggleMutation.isPending}
      />
    </DashboardLayout>
  )
}
