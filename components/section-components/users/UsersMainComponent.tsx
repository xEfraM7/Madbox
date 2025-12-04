"use client"

import { useState } from "react"
import { DashboardLayout } from "@/components/shared/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Search, MoreVertical, Edit, Trash2, Eye, Snowflake, Calendar } from "lucide-react"
import { UserFormModal } from "./modals/user-form-modal"
import { UserDetailModal } from "./modals/user-detail-modal"

const usersData = [
  { id: 1, name: "Carlos Rodríguez", email: "carlos@email.com", plan: "Premium", status: "active", phone: "+34 600 123 456", startDate: "15/01/2024", frozen: false },
  { id: 2, name: "María García", email: "maria@email.com", plan: "Básico", status: "active", phone: "+34 600 234 567", startDate: "20/02/2024", frozen: false },
  { id: 3, name: "Juan López", email: "juan@email.com", plan: "Mensual", status: "pending", phone: "+34 600 345 678", startDate: "10/03/2024", frozen: false },
  { id: 4, name: "Ana Martínez", email: "ana@email.com", plan: "Premium", status: "frozen", phone: "+34 600 456 789", startDate: "05/12/2023", frozen: true },
  { id: 5, name: "Pedro Sánchez", email: "pedro@email.com", plan: "Básico", status: "expired", phone: "+34 600 567 890", startDate: "01/01/2024", frozen: false },
]

const statusConfig = {
  active: { variant: "default" as const, label: "Activo" },
  pending: { variant: "secondary" as const, label: "Pendiente" },
  frozen: { variant: "outline" as const, label: "Congelado" },
  expired: { variant: "destructive" as const, label: "Vencido" },
}

export default function UsersMainComponent() {
  const [users, setUsers] = useState(usersData)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [planFilter, setPlanFilter] = useState("all")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)

  const filteredUsers = users.filter((user) => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) || user.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || user.status === statusFilter
    const matchesPlan = planFilter === "all" || user.plan === planFilter
    return matchesSearch && matchesStatus && matchesPlan
  })

  const handleDelete = (userId: number) => {
    if (confirm("¿Estás seguro de que deseas eliminar este usuario?")) {
      setUsers(users.filter((u) => u.id !== userId))
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-balance">Gestión de Usuarios</h1>
            <p className="text-muted-foreground mt-2">Administra todos los miembros del gimnasio</p>
          </div>
          <Button onClick={() => { setSelectedUser(null); setIsModalOpen(true) }}>
            <Plus className="mr-2 h-4 w-4" />
            Agregar Usuario
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por nombre o correo..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue placeholder="Filtrar por estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="frozen">Congelado</SelectItem>
                  <SelectItem value="expired">Vencido</SelectItem>
                </SelectContent>
              </Select>
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger><SelectValue placeholder="Filtrar por plan" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los planes</SelectItem>
                  <SelectItem value="Básico">Básico</SelectItem>
                  <SelectItem value="Premium">Premium</SelectItem>
                  <SelectItem value="Mensual">Mensual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Usuarios ({filteredUsers.length})</CardTitle>
            <CardDescription>Vista completa de todos los miembros registrados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Correo</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No se encontraron usuarios</TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell className="text-muted-foreground">{user.email}</TableCell>
                        <TableCell><Badge variant="outline">{user.plan}</Badge></TableCell>
                        <TableCell><Badge variant={statusConfig[user.status as keyof typeof statusConfig].variant}>{statusConfig[user.status as keyof typeof statusConfig].label}</Badge></TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setSelectedUser(user); setIsDetailModalOpen(true) }}><Eye className="mr-2 h-4 w-4" />Ver detalle</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setSelectedUser(user); setIsModalOpen(true) }}><Edit className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
                              <DropdownMenuItem><Snowflake className="mr-2 h-4 w-4" />{user.frozen ? "Descongelar" : "Congelar"}</DropdownMenuItem>
                              <DropdownMenuItem><Calendar className="mr-2 h-4 w-4" />Cambiar fecha de pago</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDelete(user.id)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Eliminar</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <UserFormModal open={isModalOpen} onOpenChange={setIsModalOpen} user={selectedUser} />
      <UserDetailModal open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen} user={selectedUser} />
    </DashboardLayout>
  )
}
