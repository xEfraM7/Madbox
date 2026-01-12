"use client"

import type React from "react"
import { useState, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { usePermissions } from "@/lib/hooks/use-permissions"
import { ExchangeRateModal } from "./exchange-rate-modal"

import { Home, Users, Shield, CreditCard, DollarSign, Calendar, CalendarCheck, Settings, LogOut, Menu, X, ChevronDown } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
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

  // Touch handling for swipe-to-close (sidebar)
  const touchStartY = useRef<number | null>(null)
  const touchCurrentY = useRef<number | null>(null)
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  // Touch handling for swipe-to-open (main content)
  const touchStartX = useRef<number | null>(null)
  const touchCurrentX = useRef<number | null>(null)
  const touchStartFromEdge = useRef<boolean>(false)

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
    setIsDragging(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    touchCurrentY.current = e.touches[0].clientY
    if (touchStartY.current !== null && touchCurrentY.current !== null) {
      const deltaY = touchCurrentY.current - touchStartY.current
      // Only allow dragging down (positive deltaY)
      if (deltaY > 0) {
        setDragOffset(deltaY)
      }
    }
  }

  const handleTouchEnd = () => {
    if (touchStartY.current !== null && touchCurrentY.current !== null) {
      const deltaY = touchCurrentY.current - touchStartY.current
      // If swiped down more than 100px, close the sidebar
      if (deltaY > 100) {
        setSidebarOpen(false)
      }
    }
    // Reset drag state
    touchStartY.current = null
    touchCurrentY.current = null
    setDragOffset(0)
    setIsDragging(false)
  }

  // Swipe right from left edge to open sidebar
  const handleMainTouchStart = (e: React.TouchEvent) => {
    const touchX = e.touches[0].clientX
    // Only track if touch started within 30px of left edge
    if (touchX < 30) {
      touchStartX.current = touchX
      touchStartFromEdge.current = true
    } else {
      touchStartFromEdge.current = false
    }
  }

  const handleMainTouchMove = (e: React.TouchEvent) => {
    if (touchStartFromEdge.current) {
      touchCurrentX.current = e.touches[0].clientX
    }
  }

  const handleMainTouchEnd = () => {
    if (touchStartFromEdge.current && touchStartX.current !== null && touchCurrentX.current !== null) {
      const deltaX = touchCurrentX.current - touchStartX.current
      // If swiped right more than 50px from left edge, open sidebar
      if (deltaX > 50 && !sidebarOpen) {
        setSidebarOpen(true)
      }
    }
    touchStartX.current = null
    touchCurrentX.current = null
    touchStartFromEdge.current = false
  }

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
      {/* Overlay */}
      <div className={cn("fixed inset-0 z-50 bg-background/80 backdrop-blur-sm lg:hidden", sidebarOpen ? "block" : "hidden")} onClick={() => setSidebarOpen(false)} />

      {/* Mobile Sidebar - Bottom Sheet Style */}
      <aside
        className={cn(
          "fixed z-50 bg-sidebar border-sidebar-border transform",
          // Only apply transition when not dragging (for spring-back effect)
          !isDragging && "transition-transform duration-300 ease-in-out",
          // Mobile: bottom sheet
          "lg:hidden inset-x-0 bottom-0 h-[85vh] rounded-t-2xl border-t",
          !isDragging && (sidebarOpen ? "translate-y-0" : "translate-y-full")
        )}
        style={isDragging ? { transform: `translateY(${dragOffset}px)` } : undefined}
      >
        <div className="flex h-full flex-col">
          {/* Handle bar for mobile - swipe down to close */}
          <div
            className="flex justify-center py-3 cursor-grab active:cursor-grabbing touch-pan-y"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="w-12 h-1.5 rounded-full bg-sidebar-foreground/20" />
          </div>

          {/* Mobile Header */}
          <div className="flex items-center justify-between px-4 pb-4 border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 overflow-hidden rounded-lg">
                <img src="/Madbox_logo.jpeg" alt="Madbox" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-sidebar-foreground">{gymName}</h1>
                <p className="text-xs text-sidebar-foreground/60">Gestión completa</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} className="text-sidebar-foreground/70">
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Mobile Navigation - Larger touch targets */}
          <nav className="flex-1 overflow-y-auto px-4 py-4">
            <ul className="space-y-2">
              {filteredNavigation.map((item) => {
                const isActive = pathname === item.href
                const Icon = item.icon
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "flex items-center gap-4 rounded-xl px-4 py-4 text-base font-medium transition-colors",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground active:bg-sidebar-accent"
                      )}
                    >
                      <Icon className="h-6 w-6 shrink-0" />
                      {item.name}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* Mobile User Section */}
          <div className="border-t border-sidebar-border p-4 safe-area-bottom">
            <div className="flex items-center gap-3 bg-sidebar-accent/30 rounded-xl p-3">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-primary text-primary-foreground text-lg">{userName.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium text-sidebar-foreground truncate">{userName}</p>
                <p className="text-xs text-sidebar-foreground/60 truncate">{userEmail}</p>
                <p className="text-xs text-primary truncate">{userRole}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => signOut()} className="text-sidebar-foreground/70 hover:text-destructive h-12 w-12">
                <LogOut className="h-6 w-6" />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Desktop Sidebar - Unchanged */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border lg:static">
        <div className="flex h-full flex-col w-full">
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

      <div
        className="flex-1 flex flex-col overflow-hidden"
        onTouchStart={handleMainTouchStart}
        onTouchMove={handleMainTouchMove}
        onTouchEnd={handleMainTouchEnd}
      >
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 lg:px-6 shrink-0">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(!sidebarOpen)}>
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <h2 className="text-lg font-semibold text-foreground">{filteredNavigation.find((item) => item.href === pathname)?.name || "Dashboard"}</h2>
          </div>

          {/* Mobile: Dropdown menu */}
          <div className="sm:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                  Tasas <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => { setSelectedRateType("BCV"); setRateModalOpen(true) }} className="justify-between">
                  <span className="text-blue-500 font-medium">BCV</span>
                  <span className="font-bold">{bcvRate.toFixed(2)}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSelectedRateType("USDT"); setRateModalOpen(true) }} className="justify-between">
                  <span className="text-orange-500 font-medium">USDT</span>
                  <span className="font-bold">{usdtRate.toFixed(2)}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setSelectedRateType("CUSTOM"); setRateModalOpen(true) }} className="justify-between">
                  <span className="text-purple-500 font-medium">Custom</span>
                  <span className="font-bold">{customRate.toFixed(2)}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Desktop: Individual buttons */}
          <div className="hidden sm:flex items-center gap-2">
            <button
              onClick={() => { setSelectedRateType("BCV"); setRateModalOpen(true) }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-colors cursor-pointer"
            >
              <span className="text-blue-500 font-medium text-xs">BCV</span>
              <span className="text-foreground font-bold text-sm">{bcvRate.toFixed(2)}</span>
            </button>
            <button
              onClick={() => { setSelectedRateType("USDT"); setRateModalOpen(true) }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/20 transition-colors cursor-pointer"
            >
              <span className="text-orange-500 font-medium text-xs">USDT</span>
              <span className="text-foreground font-bold text-sm">{usdtRate.toFixed(2)}</span>
            </button>
            <button
              onClick={() => { setSelectedRateType("CUSTOM"); setRateModalOpen(true) }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 transition-colors cursor-pointer"
            >
              <span className="text-purple-500 font-medium text-xs">Custom</span>
              <span className="text-foreground font-bold text-sm">{customRate.toFixed(2)}</span>
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
