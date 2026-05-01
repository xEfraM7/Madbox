"use client"

import { useQuery } from "@tanstack/react-query"
import { format, differenceInDays } from "date-fns"
import { es } from "date-fns/locale"
import { Shield, CalendarDays, Star, Loader2, AlertTriangle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getMyProfile } from "@/lib/actions/portal"

const statusConfig = {
  active:  { label: "Activo",    color: "bg-green-900/50 text-green-400 border-green-700" },
  expired: { label: "Vencido",   color: "bg-red-900/50 text-red-400 border-red-700" },
  frozen:  { label: "Congelado", color: "bg-blue-900/50 text-blue-400 border-blue-700" },
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

  const paymentDate = profile.payment_date
    ? new Date(profile.payment_date + "T00:00:00")
    : null

  const daysLeft = paymentDate ? differenceInDays(paymentDate, new Date()) : null
  const plan = profile.plans as { name: string; features: string[] | null; price: number } | null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Hola, {profile.name?.split(" ")[0]}</h1>
        <p className="text-muted-foreground text-sm mt-1">Este es el estado de tu membresía</p>
      </div>

      {/* Status card */}
      <Card className={cn(
        "border",
        cfg.color.includes("red") ? "border-red-800" :
        cfg.color.includes("blue") ? "border-blue-800" : "border-green-800"
      )}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Estado</p>
                <Badge className={cn("mt-1 border", cfg.color)}>{cfg.label}</Badge>
              </div>
            </div>
            {paymentDate && (
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Vencimiento</p>
                <p className="font-semibold">
                  {format(paymentDate, "d MMM yyyy", { locale: es })}
                </p>
                {daysLeft !== null && daysLeft >= 0 && (
                  <p className="text-xs text-muted-foreground">{daysLeft} días restantes</p>
                )}
                {daysLeft !== null && daysLeft < 0 && (
                  <p className="text-xs text-red-400 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Vencido hace {Math.abs(daysLeft)} días
                  </p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Plan card */}
      {plan && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Star className="h-4 w-4 text-primary" />
              {plan.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {plan.features && plan.features.length > 0 && (
              <ul className="space-y-1">
                {plan.features.map((f: string, i: number) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* Start date */}
      {profile.start_date && (
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Miembro desde</p>
              <p className="font-medium">
                {format(new Date(profile.start_date + "T00:00:00"), "d 'de' MMMM yyyy", { locale: es })}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
