"use client"

import type React from "react"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { usePermissions } from "@/lib/hooks/use-permissions"
import { ExchangeRateModal } from "./exchange-rate-modal"

import { Home, Users, Shield, CreditCard, DollarSign, Calendar, CalendarCheck, Settings, LogOut, Menu, X } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut, getUser } from "@/lib/actions/auth"
import { getGymSettings } from "@/lib/actions/settings"
import { getAdmins } from "@/lib/actions/roles"
import { getExchangeRates } from "@/lib/actions/funds"

const navigation = [
  { name: "Inicio", href: "/dashboard", icon: Home, permissions: ["dashboard.view"] },
  { name: "Clientes", href: "/dashboard/users", icon: Users, permissions: ["users.view"] },
  { name: "Roles y Permisos", href: "/dashboard/roles", icon: Shield, permissions: ["roles.view", "roles.edit"] },
  { name: "Planes", href: "/dashboard/plans", icon: CreditCard, permissions: ["plans.view"] },
  { name: "Pagos", href: "/dashboard/payments", icon: DollarSign, permissions: ["payments.view"] },
  { name: "Clases Especiales", href: "/dashboard/classes", icon: Calendar, permissions: ["classes.view"] },
  { name: "Cierres", href: "/dashboard/closings", icon: CalendarCheck, permissions: ["closings.view"] },
  { name: "Configuración", href: "/dashboard/settings", icon: Settings, permissions: ["settings.view"] },
]

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [rateModalOpen, setRateModalOpen] = useState(false)
  const [selectedRateType, setSelectedRateType] = useState<"BCV" | "USDT" | "CUSTOM" | null>(null)
  const pathname = usePathname()
  const { hasAnyPermission, isAdmin } = usePermissions()

  const { data: gymSettings } = useQuery({
    queryKey: ["gym-settings"],
    queryFn: getGymSettings,
  })

  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: getUser,
  })

  const { data: admins = [] } = useQuery({
    queryKey: ["admins"],
    queryFn: getAdmins,
  })

  const { data: exchangeRates = [] } = useQuery({
    queryKey: ["exchange-rates"],
    queryFn: getExchangeRates,
  })

  const bcvRate = exchangeRates.find((r: any) => r.type === "BCV")?.rate || 0
  const usdtRate = exchangeRates.find((r: any) => r.type === "USDT")?.rate || 0
  const customRate = exchangeRates.find((r: any) => r.type === "CUSTOM")?.rate || 0

  // Buscar el admin actual por email
  const currentAdmin = admins.find((admin: any) => admin.email === currentUser?.email)
  const userName = currentAdmin?.name || currentUser?.email?.split("@")[0] || "Usuario"
  const userEmail = currentUser?.email || ""
  const userRole = currentAdmin?.roles?.name || "Admin"

  const gymName = gymSettings?.name || "Madbox"

  // Filtrar navegación según permisos
  const filteredNavigation = navigation.filter(item => {
    if (isAdmin) return true
    return hasAnyPermission(item.permissions)
  })

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className={cn("fixed inset-0 z-50 bg-background/80 backdrop-blur-sm lg:hidden", sidebarOpen ? "block" : "hidden")} onClick={() => setSidebarOpen(false)} />

      <aside className={cn("fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static", sidebarOpen ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
            <div className="w-10 h-10 overflow-hidden">
              <img src="/Madbox_logo.jpeg" alt="Madbox" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-sidebar-foreground">{gymName}</h1>
              <p className="text-xs text-sidebar-foreground/60">Gestión completa</p>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <ul className="space-y-1">
              {filteredNavigation.map((item) => {
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
                <AvatarFallback className="bg-primary text-primary-foreground">{userName.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium text-sidebar-foreground truncate">{userName}</p>
                <p className="text-xs text-sidebar-foreground/60 truncate">{userEmail}</p>
                <p className="text-xs text-primary truncate">{userRole}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => signOut()} className="text-sidebar-foreground/70 hover:text-destructive">
                <LogOut className="h-5 w-5" />
              </Button>
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
            <h2 className="text-lg font-semibold text-foreground">{filteredNavigation.find((item) => item.href === pathname)?.name || "Dashboard"}</h2>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <button
              onClick={() => { setSelectedRateType("BCV"); setRateModalOpen(true) }}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-colors cursor-pointer text-xs sm:text-sm"
            >
              <span className="text-blue-500 font-medium">BCV</span>
              <span className="text-foreground font-bold">{bcvRate.toFixed(2)}</span>
            </button>
            <button
              onClick={() => { setSelectedRateType("USDT"); setRateModalOpen(true) }}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/20 transition-colors cursor-pointer text-xs sm:text-sm"
            >
              <span className="text-orange-500 font-medium">USDT</span>
              <span className="text-foreground font-bold">{usdtRate.toFixed(2)}</span>
            </button>
            <button
              onClick={() => { setSelectedRateType("CUSTOM"); setRateModalOpen(true) }}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-md bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 transition-colors cursor-pointer text-xs sm:text-sm"
            >
              <span className="text-purple-500 font-medium">Custom</span>
              <span className="text-foreground font-bold">{customRate.toFixed(2)}</span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-background">
          <div className="container mx-auto p-4 lg:p-6">{children}</div>
        </main>
      </div>

      <ExchangeRateModal
        open={rateModalOpen}
        onOpenChange={setRateModalOpen}
        type={selectedRateType}
        currentRate={selectedRateType === "BCV" ? bcvRate : selectedRateType === "USDT" ? usdtRate : customRate}
      />
    </div>
  )
}
