"use client"

import { useState } from "react"
import { DashboardLayout } from "@/components/shared/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Plus, MoreVertical, Edit, Trash2, Shield } from "lucide-react"
import { AdminFormModal } from "./modals/admin-form-modal"
import { RoleFormModal } from "./modals/role-form-modal"
import { Checkbox } from "@/components/ui/checkbox"

const adminsData = [
  { id: 1, name: "Admin Principal", email: "admin@gimnasio.com", role: "Super Admin", status: "active" },
  { id: 2, name: "Laura Recepción", email: "laura@gimnasio.com", role: "Recepcionista", status: "active" },
  { id: 3, name: "Miguel Finanzas", email: "miguel@gimnasio.com", role: "Contador", status: "active" },
]

const rolesData = [
  { id: 1, name: "Super Admin", description: "Acceso total al sistema", permissions: ["users", "payments", "plans", "roles", "settings", "reports"], userCount: 1 },
  { id: 2, name: "Recepcionista", description: "Gestión de usuarios y pagos básicos", permissions: ["users", "payments"], userCount: 3 },
  { id: 3, name: "Contador", description: "Acceso a finanzas y reportes", permissions: ["payments", "plans", "reports"], userCount: 1 },
  { id: 4, name: "Instructor", description: "Gestión de clases y usuarios", permissions: ["users", "classes"], userCount: 5 },
]

export const allPermissions = [
  { id: "users", label: "Gestionar Usuarios", description: "Ver, crear y editar usuarios" },
  { id: "payments", label: "Gestionar Pagos", description: "Ver y registrar pagos" },
  { id: "plans", label: "Gestionar Planes", description: "Crear y editar planes" },
  { id: "roles", label: "Gestionar Roles", description: "Administrar roles y permisos" },
  { id: "classes", label: "Gestionar Clases", description: "Programar y editar clases" },
  { id: "reports", label: "Ver Reportes", description: "Acceso a reportes y estadísticas" },
  { id: "settings", label: "Configuración", description: "Modificar configuración del sistema" },
]

export default function RolesMainComponent() {
  const [admins, setAdmins] = useState(adminsData)
  const [roles, setRoles] = useState(rolesData)
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false)
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false)
  const [selectedAdmin, setSelectedAdmin] = useState<any>(null)
  const [selectedRole, setSelectedRole] = useState<any>(null)

  const handleDeleteAdmin = (adminId: number) => {
    if (confirm("¿Estás seguro de que deseas eliminar este administrador?")) {
      setAdmins(admins.filter((a) => a.id !== adminId))
    }
  }

  const handleDeleteRole = (roleId: number) => {
    if (confirm("¿Estás seguro de que deseas eliminar este rol?")) {
      setRoles(roles.filter((r) => r.id !== roleId))
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-balance">Roles y Permisos</h1>
          <p className="text-muted-foreground mt-2">Administra el acceso y permisos de los usuarios administrativos</p>
        </div>

        <Tabs defaultValue="admins" className="space-y-6">
          <TabsList>
            <TabsTrigger value="admins">Administradores</TabsTrigger>
            <TabsTrigger value="roles">Roles</TabsTrigger>
            <TabsTrigger value="permissions">Permisos</TabsTrigger>
          </TabsList>

          <TabsContent value="admins" className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold">Lista de Administradores</h2>
                <p className="text-sm text-muted-foreground">Usuarios con acceso al panel administrativo</p>
              </div>
              <Button onClick={() => { setSelectedAdmin(null); setIsAdminModalOpen(true) }}>
                <Plus className="mr-2 h-4 w-4" />Agregar Administrador
              </Button>
            </div>
            <Card>
              <CardContent className="pt-6">
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Correo</TableHead>
                        <TableHead>Rol</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {admins.map((admin) => (
                        <TableRow key={admin.id}>
                          <TableCell className="font-medium">{admin.name}</TableCell>
                          <TableCell className="text-muted-foreground">{admin.email}</TableCell>
                          <TableCell><Badge variant="outline">{admin.role}</Badge></TableCell>
                          <TableCell><Badge>{admin.status === "active" ? "Activo" : "Inactivo"}</Badge></TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => { setSelectedAdmin(admin); setIsAdminModalOpen(true) }}><Edit className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDeleteAdmin(admin.id)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Eliminar</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="roles" className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold">Gestión de Roles</h2>
                <p className="text-sm text-muted-foreground">Crea y administra roles con permisos personalizados</p>
              </div>
              <Button onClick={() => { setSelectedRole(null); setIsRoleModalOpen(true) }}>
                <Plus className="mr-2 h-4 w-4" />Crear Rol
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {roles.map((role) => (
                <Card key={role.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Shield className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{role.name}</CardTitle>
                          <CardDescription className="mt-1">{role.userCount} usuario{role.userCount !== 1 ? "s" : ""}</CardDescription>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setSelectedRole(role); setIsRoleModalOpen(true) }}><Edit className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteRole(role.id)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Eliminar</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">{role.description}</p>
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Permisos:</p>
                      <div className="flex flex-wrap gap-1">
                        {role.permissions.map((permission) => (
                          <Badge key={permission} variant="secondary" className="text-xs">{allPermissions.find((p) => p.id === permission)?.label}</Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="permissions" className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Permisos Disponibles</h2>
              <p className="text-sm text-muted-foreground">Lista completa de permisos que pueden asignarse a los roles</p>
            </div>
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {allPermissions.map((permission) => (
                    <div key={permission.id} className="flex items-start gap-4 border-b border-border pb-4 last:border-0 last:pb-0">
                      <Checkbox id={permission.id} className="mt-1" disabled />
                      <div className="flex-1">
                        <label htmlFor={permission.id} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{permission.label}</label>
                        <p className="text-sm text-muted-foreground mt-1">{permission.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AdminFormModal open={isAdminModalOpen} onOpenChange={setIsAdminModalOpen} admin={selectedAdmin} availableRoles={roles.map((r) => r.name)} />
      <RoleFormModal open={isRoleModalOpen} onOpenChange={setIsRoleModalOpen} role={selectedRole} allPermissions={allPermissions} />
    </DashboardLayout>
  )
}
