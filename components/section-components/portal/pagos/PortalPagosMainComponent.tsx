"use client"

import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CreditCard, Loader2, Receipt } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getMyPayments } from "@/lib/actions/portal"

export default function PortalPagosMainComponent() {
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["my-payments"],
    queryFn: getMyPayments,
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold">Mis Pagos</h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
            Historial de pagos de membresía
          </p>
        </div>
        {payments.length > 0 && (
          <Badge variant="outline" className="text-xs">
            {payments.length} {payments.length === 1 ? "registro" : "registros"}
          </Badge>
        )}
      </div>

      {payments.length === 0 ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Receipt className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No tienes pagos registrados.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {payments.map((payment: any) => (
            <Card key={payment.id} className="transition-colors hover:border-primary/30">
              <CardContent className="py-4 sm:py-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-green-900/30 shrink-0">
                      <CreditCard className="h-5 w-5 text-green-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">
                        {payment.plans?.name ?? "Plan"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {payment.payment_date
                          ? format(new Date(payment.payment_date + "T00:00:00"), "d MMM yyyy", { locale: es })
                          : "—"}
                      </p>
                      {payment.reference && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          Ref: {payment.reference}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold text-green-400 text-sm sm:text-base">
                      {payment.amount?.toLocaleString("es-VE")}
                    </p>
                    <Badge variant="outline" className="text-[10px] sm:text-xs mt-1">
                      {payment.method ?? "—"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
