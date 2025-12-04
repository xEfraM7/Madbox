"use client"

import type React from "react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Home, Users, Shield, CreditCard, DollarSign, Calendar, Settings, Bell, LogOut, Menu, X, Dumbbell } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { signOut } from "@/lib/actions/auth"

const navigation = [
  { name: "Inicio", href: "/dashboard", icon: Home },
  { name: "Clientes", href: "/dashboard/users", icon: Users },
  { name: "Roles y Permisos", href: "/dashboard/roles", icon: Shield },
  { name: "Planes", href: "/dashboard/plans", icon: CreditCard },
  { name: "Pagos", href: "/dashboard/payments", icon: DollarSign },
  { name: "Clases Especiales", href: "/dashboard/classes", icon: Calendar },
  { name: "Configuración", href: "/dashboard/settings", icon: Settings },
]

interface DashboardLayoutProps {
  children: React.ReactNode
  userName?: string
  userEmail?: string
  notifications?: number
}

export function DashboardLayout({ children, userName = "Admin Principal", userEmail = "admin@gimnasio.com", notifications = 3 }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className={cn("fixed inset-0 z-50 bg-background/80 backdrop-blur-sm lg:hidden", sidebarOpen ? "block" : "hidden")} onClick={() => setSidebarOpen(false)} />

      <aside className={cn("fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static", sidebarOpen ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Dumbbell className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-sidebar-foreground">FitAdmin Pro</h1>
              <p className="text-xs text-sidebar-foreground/60">Gestión completa</p>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <ul className="space-y-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href
                const Icon = item.icon
                return (
                  <li key={item.name}>
                    <Link href={item.href} className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors", isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground")}>
                      <Icon className="h-5 w-5 shrink-0" />
                      {item.name}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>

          <div className="border-t border-sidebar-border p-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src="/placeholder.svg?height=40&width=40" />
                <AvatarFallback className="bg-primary text-primary-foreground">{userName.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium text-sidebar-foreground truncate">{userName}</p>
                <p className="text-xs text-sidebar-foreground/60 truncate">{userEmail}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 lg:px-6 shrink-0">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(!sidebarOpen)}>
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <h2 className="text-lg font-semibold text-foreground">{navigation.find((item) => item.href === pathname)?.name || "Dashboard"}</h2>
          </div>

          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  {notifications > 0 && <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">{notifications}</Badge>}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>Notificaciones</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="space-y-2 p-2">
                  <div className="text-sm p-2 rounded-md hover:bg-accent"><p className="font-medium">Nuevo usuario registrado</p><p className="text-xs text-muted-foreground">Hace 5 minutos</p></div>
                  <div className="text-sm p-2 rounded-md hover:bg-accent"><p className="font-medium">Pago vencido - Juan Pérez</p><p className="text-xs text-muted-foreground">Hace 2 horas</p></div>
                  <div className="text-sm p-2 rounded-md hover:bg-accent"><p className="font-medium">Nueva clase programada</p><p className="text-xs text-muted-foreground">Hace 1 día</p></div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="/placeholder.svg?height=32&width=32" />
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm">{userName.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium hidden md:inline">{userName}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Mi cuenta</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem><Settings className="mr-2 h-4 w-4" />Configuración</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={() => signOut()}><LogOut className="mr-2 h-4 w-4" />Cerrar sesión</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-background">
          <div className="container mx-auto p-4 lg:p-6">{children}</div>
        </main>
      </div>
    </div>
  )
}
