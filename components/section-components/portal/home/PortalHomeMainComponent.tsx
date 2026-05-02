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

  return (
    <div className="space-y-5 sm:space-y-6">
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
            Este es el estado de tu membresía
          </p>
        </div>
      </div>

      {/* Status + Plan: 2-col en md+ */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className={cn("border", cfg.accent)}>
          <CardContent className="pt-5 sm:pt-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Shield className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm text-muted-foreground">Estado</p>
                  <Badge className={cn("mt-1 border", cfg.color)}>{cfg.label}</Badge>
                </div>
              </div>
              {paymentDate && (
                <div className="text-right shrink-0">
                  <p className="text-xs text-muted-foreground">Vencimiento</p>
                  <p className="font-semibold text-sm sm:text-base">
                    {format(paymentDate, "d MMM yyyy", { locale: es })}
                  </p>
                  {daysLeft !== null && daysLeft >= 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {daysLeft} {daysLeft === 1 ? "día" : "días"}
                    </p>
                  )}
                  {daysLeft !== null && daysLeft < 0 && (
                    <p className="text-xs text-red-400 flex items-center gap-1 mt-0.5 justify-end">
                      <AlertTriangle className="h-3 w-3" />
                      Hace {Math.abs(daysLeft)} días
                    </p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {plan ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                <Star className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate">{plan.name}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {plan.features && plan.features.length > 0 ? (
                <ul className="space-y-1.5">
                  {plan.features.map((f: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-xs sm:text-sm text-muted-foreground">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">Plan sin descripción</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">No tienes un plan asignado</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Rutina del día — full width */}
      <TodayRoutineCard />

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
