"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Home, Calendar, CreditCard, User, LogOut, Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { signOut } from "@/lib/actions/auth"
import { getMyProfile } from "@/lib/actions/portal"

const nav = [
  { name: "Inicio", href: "/portal", icon: Home },
  { name: "Clases", href: "/portal/clases", icon: Calendar },
  { name: "Pagos", href: "/portal/pagos", icon: CreditCard },
  { name: "Perfil", href: "/portal/perfil", icon: User },
]

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: getMyProfile,
    staleTime: 5 * 60 * 1000,
  })

  const initials = profile?.name
    ? profile.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?"

  const statusBanner =
    pathname !== "/portal/cambiar-contrasena" && profile?.status === "expired"
      ? { msg: "Tu membresía venció. Habla con el gimnasio para renovar.", color: "bg-red-900/80 border-red-700 text-red-100" }
      : pathname !== "/portal/cambiar-contrasena" && profile?.status === "frozen"
      ? { msg: "Tu cuenta está congelada temporalmente.", color: "bg-blue-900/80 border-blue-700 text-blue-100" }
      : null

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center justify-between px-4">
          <span className="font-bold text-primary text-xl tracking-tight">Madbox</span>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {nav.map((item) => {
              const Icon = item.icon
              const active = pathname === item.href
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn("gap-2", active && "bg-primary/10 text-primary")}
                  >
                    <Icon className="h-4 w-4" />
                    {item.name}
                  </Button>
                </Link>
              )
            })}
          </nav>

          {/* User section */}
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium text-muted-foreground hidden lg:block">
                {profile?.name}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => signOut()}
            >
              <LogOut className="h-4 w-4" />
            </Button>
            {/* Mobile menu toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-background px-4 py-2 flex flex-col gap-1">
            {nav.map((item) => {
              const Icon = item.icon
              const active = pathname === item.href
              return (
                <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)}>
                  <Button
                    variant="ghost"
                    className={cn("w-full justify-start gap-2", active && "bg-primary/10 text-primary")}
                  >
                    <Icon className="h-4 w-4" />
                    {item.name}
                  </Button>
                </Link>
              )
            })}
          </div>
        )}
      </header>

      {/* Status banner */}
      {statusBanner && (
        <div className={cn("border-b px-4 py-2 text-sm text-center font-medium", statusBanner.color)}>
          {statusBanner.msg}
        </div>
      )}

      {/* Content */}
      <main className="flex-1 container mx-auto max-w-3xl px-4 py-6">
        {children}
      </main>

      {/* Bottom nav (mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur">
        <div className="flex">
          {nav.map((item) => {
            const Icon = item.icon
            const active = pathname === item.href
            return (
              <Link key={item.href} href={item.href} className="flex-1">
                <div className={cn(
                  "flex flex-col items-center gap-1 py-2 text-xs font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}>
                  <Icon className="h-5 w-5" />
                  {item.name}
                </div>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Spacer para bottom nav en mobile */}
      <div className="md:hidden h-16" />
    </div>
  )
}
