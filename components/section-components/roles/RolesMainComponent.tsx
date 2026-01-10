"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { showToast } from "@/lib/sweetalert"
import { DashboardLayout } from "@/components/shared/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Plus, MoreVertical, Edit, Trash2, Shield, Loader2, Mail } from "lucide-react"
import { AdminFormModal } from "./modals/admin-form-modal"
import { RoleFormModal } from "./modals/role-form-modal"
import { InviteModal } from "./modals/invite-modal"
import { UserRoleModal } from "./modals/user-role-modal"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { getRoles, deleteRole, getAdmins, getAllAdmins, deleteAdmin, getAllAuthUsers, deleteUser } from "@/lib/actions/roles"

export const permissionGroups = [
  {
    id: "users",
    label: "Usuarios",
    permissions: [
      { id: "users.view", label: "Ver usuarios", description: "Ver lista de clientes" },
      { id: "users.create", label: "Crear usuarios", description: "Registrar nuevos clientes" },
      { id: "users.edit", label: "Editar usuarios", description: "Modificar información de clientes" },
      { id: "users.delete", label: "Eliminar usuarios", description: "Eliminar clientes del sistema" },
    ]
  },
  {
    id: "payments",
    label: "Pagos",
    permissions: [
      { id: "payments.view", label: "Ver pagos", description: "Ver historial de pagos" },
      { id: "payments.create", label: "Registrar pagos", description: "Crear nuevos pagos" },
      { id: "payments.edit", label: "Editar pagos", description: "Modificar pagos existentes" },
      { id: "payments.delete", label: "Eliminar pagos", description: "Eliminar registros de pagos" },
    ]
  },
  {
    id: "plans",
    label: "Planes",
    permissions: [
      { id: "plans.view", label: "Ver planes", description: "Ver planes disponibles" },
      { id: "plans.create", label: "Crear planes", description: "Crear nuevos planes" },
      { id: "plans.edit", label: "Editar planes", description: "Modificar planes existentes" },
      { id: "plans.delete", label: "Eliminar planes", description: "Eliminar planes" },
    ]
  },
  {
    id: "classes",
    label: "Clases Especiales",
    permissions: [
      { id: "classes.view", label: "Ver clases", description: "Ver clases programadas" },
      { id: "classes.create", label: "Crear clases", description: "Programar nuevas clases" },
      { id: "classes.edit", label: "Editar clases", description: "Modificar clases existentes" },
      { id: "classes.delete", label: "Eliminar clases", description: "Eliminar clases" },
    ]
  },
  {
    id: "closings",
    label: "Cierres Mensuales",
    permissions: [
      { id: "closings.view", label: "Ver cierres", description: "Ver historial de cierres mensuales" },
      { id: "closings.edit", label: "Realizar cierres", description: "Ejecutar cierre de mes" },
    ]
  },
  {
    id: "roles",
    label: "Roles y Administradores",
    permissions: [
      { id: "roles.view", label: "Ver roles", description: "Ver roles y administradores" },
      { id: "roles.create", label: "Crear roles", description: "Crear nuevos roles" },
      { id: "roles.edit", label: "Editar roles", description: "Modificar roles y permisos" },
      { id: "roles.delete", label: "Eliminar roles", description: "Eliminar roles" },
    ]
  },
  {
    id: "settings",
    label: "Configuración",
    permissions: [
      { id: "settings.view", label: "Ver configuración", description: "Ver configuración del gimnasio" },
      { id: "settings.edit", label: "Editar configuración", description: "Modificar configuración del sistema" },
    ]
  },
  {
    id: "dashboard",
    label: "Dashboard",
    permissions: [
      { id: "dashboard.view", label: "Ver dashboard", description: "Acceso al panel principal" },
      { id: "dashboard.reports", label: "Ver reportes", description: "Acceso a estadísticas y reportes" },
    ]
  },
]

// Flat list for backward compatibility
export const allPermissions = permissionGroups.flatMap(group => group.permissions)

export default function RolesMainComponent() {
  const queryClient = useQueryClient()
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false)
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false)
  const [selectedAdmin, setSelectedAdmin] = useState<any>(null)
  const [selectedRole, setSelectedRole] = useState<any>(null)
  const [deleteAdminDialog, setDeleteAdminDialog] = useState(false)
  const [deleteRoleDialog, setDeleteRoleDialog] = useState(false)
  const [adminToDelete, setAdminToDelete] = useState<any>(null)
  const [roleToDelete, setRoleToDelete] = useState<any>(null)
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [isUserRoleModalOpen, setIsUserRoleModalOpen] = useState(false)
  const [selectedUserAdmin, setSelectedUserAdmin] = useState<any>(null)
  const [deleteUserDialog, setDeleteUserDialog] = useState(false)
  const [userToDelete, setUserToDelete] = useState<any>(null)

  const { data: roles = [], isLoading: loadingRoles } = useQuery({
    queryKey: ["roles"],
    queryFn: getRoles,
  })

  const { data: admins = [], isLoading: loadingAdmins } = useQuery({
    queryKey: ["admins"],
    queryFn: getAdmins,
  })

  const { data: authUsers = [], isLoading: loadingAuthUsers } = useQuery({
    queryKey: ["all-auth-users"],
    queryFn: getAllAuthUsers,
  })

  // Todos los usuarios del sistema (para verificar si es admin)
  const { data: allAdmins = [] } = useQuery({
    queryKey: ["all-admins"],
    queryFn: getAllAdmins,
  })


  const deleteAdminMutation = useMutation({
    mutationFn: (id: string) => deleteAdmin(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admins"] })
      showToast.success("Administrador eliminado", `${adminToDelete?.name} ha sido eliminado.`)
      setDeleteAdminDialog(false)
      setAdminToDelete(null)
    },
    onError: () => showToast.error("Error", "No se pudo eliminar el administrador."),
  })

  const deleteRoleMutation = useMutation({
    mutationFn: (id: string) => deleteRole(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] })
      showToast.success("Rol eliminado", `${roleToDelete?.name} ha sido eliminado.`)
      setDeleteRoleDialog(false)
      setRoleToDelete(null)
    },
    onError: () => showToast.error("Error", "No se pudo eliminar el rol. Puede tener administradores asignados."),
  })

  const deleteUserMutation = useMutation({
    mutationFn: (authUserId: string) => deleteUser(authUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-auth-users"] })
      queryClient.invalidateQueries({ queryKey: ["all-admins"] })
      queryClient.invalidateQueries({ queryKey: ["admins"] })
      showToast.success("Usuario eliminado", `${userToDelete?.email} ha sido eliminado.`)
      setDeleteUserDialog(false)
      setUserToDelete(null)
    },
    onError: () => showToast.error("Error", "No se pudo eliminar el usuario."),
  })

  const getAdminCountByRole = (roleId: string) => {
    return admins.filter((a: any) => a.role_id === roleId).length
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
            <TabsTrigger value="users">Usuarios</TabsTrigger>
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
                {loadingAdmins ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nombre</TableHead>
                          <TableHead className="hidden sm:table-cell">Correo</TableHead>
                          <TableHead className="hidden md:table-cell">Rol</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {admins.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">No hay administradores registrados</TableCell>
                          </TableRow>
                        ) : (
                          admins.map((admin: any) => (
                            <TableRow key={admin.id}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{admin.name}</p>
                                  <p className="text-xs text-muted-foreground sm:hidden">{admin.email}</p>
                                  <p className="text-xs text-muted-foreground md:hidden sm:block hidden">{admin.roles?.name || "Sin rol"}</p>
                                </div>
                              </TableCell>
                              <TableCell className="hidden sm:table-cell text-muted-foreground">{admin.email}</TableCell>
                              <TableCell className="hidden md:table-cell"><Badge variant="outline">{admin.roles?.name || "Sin rol"}</Badge></TableCell>
                              <TableCell>
                                <Badge variant={admin.status === "active" ? "default" : "secondary"}>
                                  {admin.status === "active" ? "Activo" : "Inactivo"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => { setSelectedAdmin(admin); setIsAdminModalOpen(true) }}><Edit className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => { setAdminToDelete(admin); setDeleteAdminDialog(true) }} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Eliminar</DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-xl font-semibold">Usuarios Registrados</h2>
                <p className="text-sm text-muted-foreground">Todos los usuarios con cuenta en la aplicación</p>
              </div>
              <Button onClick={() => setIsInviteModalOpen(true)}>
                <Mail className="mr-2 h-4 w-4" />Enviar Invitación
              </Button>
            </div>
            <Card>
              <CardContent className="pt-6">
                {loadingAuthUsers ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead className="hidden lg:table-cell">Fecha de registro</TableHead>
                          <TableHead className="hidden lg:table-cell">Último acceso</TableHead>
                          <TableHead className="hidden sm:table-cell">Estado</TableHead>
                          <TableHead className="hidden md:table-cell">Rol</TableHead>
                          <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {authUsers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No hay usuarios registrados</TableCell>
                          </TableRow>
                        ) : (
                          authUsers.map((user: any) => {
                            const userAdmin = allAdmins.find((a: any) => a.email === user.email || a.auth_user_id === user.id)
                            const roleName = userAdmin?.roles?.name
                            return (
                              <TableRow key={user.id}>
                                <TableCell>
                                  <div>
                                    <p className="font-medium truncate max-w-[150px] sm:max-w-none">{user.email}</p>
                                    <div className="sm:hidden text-xs text-muted-foreground mt-1">
                                      <Badge variant={user.email_confirmed_at ? "default" : "secondary"} className="text-xs">
                                        {user.email_confirmed_at ? "Verificado" : "Pendiente"}
                                      </Badge>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="hidden lg:table-cell text-muted-foreground">
                                  {user.created_at ? new Date(user.created_at).toLocaleDateString("es-ES") : "-"}
                                </TableCell>
                                <TableCell className="hidden lg:table-cell text-muted-foreground">
                                  {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString("es-ES") : "Nunca"}
                                </TableCell>
                                <TableCell className="hidden sm:table-cell">
                                  <Badge variant={user.email_confirmed_at ? "default" : "secondary"}>
                                    {user.email_confirmed_at ? "Verificado" : "Pendiente"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="hidden md:table-cell">
                                  {roleName ? (
                                    <Badge variant="outline" className={roleName === "Super Admin" || roleName === "Admin" ? "text-primary border-primary" : ""}>
                                      {roleName === "Super Admin" || roleName === "Admin" ? <Shield className="mr-1 h-3 w-3" /> : null}
                                      {roleName}
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground text-sm">Sin rol</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      {userAdmin && (
                                        <DropdownMenuItem onClick={() => { setSelectedUserAdmin(userAdmin); setIsUserRoleModalOpen(true) }}>
                                          <Shield className="mr-2 h-4 w-4" />Cambiar Rol
                                        </DropdownMenuItem>
                                      )}
                                      <DropdownMenuItem onClick={() => { setUserToDelete(user); setDeleteUserDialog(true) }} className="text-destructive">
                                        <Trash2 className="mr-2 h-4 w-4" />Eliminar Usuario
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            )
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
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
            {loadingRoles ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : roles.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">No hay roles registrados</CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {roles.map((role: any) => (
                  <Card key={role.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Shield className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{role.name}</CardTitle>
                            <CardDescription className="mt-1">{getAdminCountByRole(role.id)} usuario{getAdminCountByRole(role.id) !== 1 ? "s" : ""}</CardDescription>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setSelectedRole(role); setIsRoleModalOpen(true) }}><Edit className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setRoleToDelete(role); setDeleteRoleDialog(true) }} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Eliminar</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-3">{role.description || "Sin descripción"}</p>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Permisos:</p>
                        <div className="flex flex-wrap gap-1">
                          {(role.permissions || []).length === 0 ? (
                            <span className="text-xs text-muted-foreground">Sin permisos asignados</span>
                          ) : (
                            permissionGroups
                              .filter(group => group.permissions.some(p => (role.permissions || []).includes(p.id)))
                              .map((group) => {
                                const count = group.permissions.filter(p => (role.permissions || []).includes(p.id)).length
                                return (
                                  <Badge key={group.id} variant="secondary" className="text-xs">
                                    {group.label} ({count})
                                  </Badge>
                                )
                              })
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="permissions" className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Permisos Disponibles</h2>
              <p className="text-sm text-muted-foreground">Lista completa de permisos que pueden asignarse a los roles</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {permissionGroups.map((group) => (
                <Card key={group.id}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{group.label}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {group.permissions.map((permission) => (
                      <div key={permission.id} className="flex items-start gap-3">
                        <Checkbox className="mt-0.5" disabled checked />
                        <div>
                          <p className="text-sm font-medium">{permission.label}</p>
                          <p className="text-xs text-muted-foreground">{permission.description}</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <AdminFormModal open={isAdminModalOpen} onOpenChange={setIsAdminModalOpen} admin={selectedAdmin} roles={roles} />
      <RoleFormModal open={isRoleModalOpen} onOpenChange={setIsRoleModalOpen} role={selectedRole} />
      <InviteModal open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen} />
      <UserRoleModal open={isUserRoleModalOpen} onOpenChange={setIsUserRoleModalOpen} user={selectedUserAdmin} roles={roles} />

      <ConfirmDialog
        open={deleteAdminDialog}
        onOpenChange={setDeleteAdminDialog}
        title="Eliminar administrador"
        description={`¿Estás seguro de que deseas eliminar a "${adminToDelete?.name}"? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
        onConfirm={() => deleteAdminMutation.mutate(adminToDelete?.id)}
        isLoading={deleteAdminMutation.isPending}
      />

      <ConfirmDialog
        open={deleteRoleDialog}
        onOpenChange={setDeleteRoleDialog}
        title="Eliminar rol"
        description={`¿Estás seguro de que deseas eliminar el rol "${roleToDelete?.name}"? Los administradores con este rol perderán sus permisos.`}
        confirmText="Eliminar"
        variant="danger"
        onConfirm={() => deleteRoleMutation.mutate(roleToDelete?.id)}
        isLoading={deleteRoleMutation.isPending}
      />

      <ConfirmDialog
        open={deleteUserDialog}
        onOpenChange={setDeleteUserDialog}
        title="Eliminar usuario"
        description={`¿Estás seguro de que deseas eliminar a "${userToDelete?.email}"? Se eliminará su cuenta y todos sus datos. Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
        onConfirm={() => deleteUserMutation.mutate(userToDelete?.id)}
        isLoading={deleteUserMutation.isPending}
      />
    </DashboardLayout>
  )
}
