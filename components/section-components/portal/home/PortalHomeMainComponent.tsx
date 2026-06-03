"use client"

import { useQuery } from "@tanstack/react-query"
import { format, differenceInDays } from "date-fns"
import { es } from "date-fns/locale"
import { Shield, CalendarDays, Star, Loader2, AlertTriangle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { getMyProfile } from "@/lib/actions/portal"
import { TodayRoutineCard } from "./TodayRoutineCard"
import { CompletarPerfilBanner } from "./CompletarPerfilBanner"

const statusConfig = {
  active:  { label: "Activo",    color: "bg-green-900/50 text-green-400 border-green-700", accent: "border-green-800" },
  expired: { label: "Vencido",   color: "bg-red-900/50 text-red-400 border-red-700",       accent: "border-red-800" },
  frozen:  { label: "Congelado", color: "bg-blue-900/50 text-blue-400 border-blue-700",    accent: "border-blue-800" },
}

export default function PortalHomeMainComponent() {
  const { data: profile, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: getMyProfile,
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!profile) return null

  const status = (profile.status ?? "expired") as keyof typeof statusConfig
  const cfg = statusConfig[status] ?? statusConfig.expired
  const firstName = profile.name?.split(" ")[0] ?? ""
  const initials = profile.name
    ? profile.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : "?"

  const paymentDate = profile.payment_date
    ? new Date(profile.payment_date + "T00:00:00")
    : null

  const daysLeft = paymentDate ? differenceInDays(paymentDate, new Date()) : null
  const plan = profile.plans as { name: string; features: string[] | null; price: number } | null

  const isActive = status === "active"

  return (
    <div className="space-y-5 sm:space-y-6">
      {!profile.gender && <CompletarPerfilBanner />}

      {/* Greeting con avatar */}
      <div className="flex items-center gap-3 sm:gap-4">
        <Avatar className="h-12 w-12 sm:h-14 sm:w-14 shrink-0 border-2 border-primary/30">
          <AvatarImage src={profile.avatar_url ?? undefined} />
          <AvatarFallback className="bg-primary/20 text-primary text-sm sm:text-base font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold leading-tight truncate">
            Hola, {firstName}
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
            Esto es lo que te toca hoy
          </p>
        </div>
      </div>

      {/* HÉROE: Rutina del día */}
      <TodayRoutineCard />

      {/* Membresía — tira compacta (acento solo si no está activa) */}
      <Card className={cn("border", !isActive && cfg.accent)}>
        <CardContent className="py-3 sm:py-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Shield className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <Badge className={cn("border", cfg.color)}>{cfg.label}</Badge>
              {plan && (
                <span className="text-sm text-muted-foreground truncate">{plan.name}</span>
              )}
            </div>
          </div>
          {paymentDate && (
            <div className="text-right shrink-0">
              {daysLeft !== null && daysLeft < 0 ? (
                <p className="text-xs text-red-400 flex items-center gap-1 justify-end">
                  <AlertTriangle className="h-3 w-3" />
                  Venció hace {Math.abs(daysLeft)} días
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Vence {format(paymentDate, "d MMM yyyy", { locale: es })}
                  {daysLeft !== null && (
                    <span className="ml-1">· {daysLeft} {daysLeft === 1 ? "día" : "días"}</span>
                  )}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plan: beneficios (secundario) */}
      {plan && plan.features && plan.features.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <Star className="h-4 w-4 text-primary shrink-0" />
              <span className="truncate">Tu plan: {plan.name}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {plan.features.map((f: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-xs sm:text-sm text-muted-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Miembro desde — footer */}
      {profile.start_date && (
        <Card>
          <CardContent className="py-4 flex items-center gap-3">
            <CalendarDays className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Miembro desde</p>
              <p className="text-sm font-medium truncate">
                {format(new Date(profile.start_date + "T00:00:00"), "d 'de' MMMM yyyy", { locale: es })}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
