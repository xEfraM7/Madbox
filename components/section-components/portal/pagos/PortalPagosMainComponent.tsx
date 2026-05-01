"use client"

import { useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CreditCard, Loader2 } from "lucide-react"
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mis Pagos</h1>
        <p className="text-muted-foreground text-sm mt-1">Historial de pagos de membresía</p>
      </div>

      {payments.length === 0 && (
        <p className="text-muted-foreground text-center py-10">No tienes pagos registrados.</p>
      )}

      <div className="space-y-3">
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {payments.map((payment: any) => (
          <Card key={payment.id}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-900/30">
                    <CreditCard className="h-5 w-5 text-green-400" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {payment.plans?.name ?? "Plan"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {payment.payment_date
                        ? format(new Date(payment.payment_date + "T00:00:00"), "d MMM yyyy", { locale: es })
                        : "—"}
                    </p>
                    {payment.reference && (
                      <p className="text-xs text-muted-foreground">Ref: {payment.reference}</p>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-green-400">
                    {payment.amount?.toLocaleString("es-VE")}
                  </p>
                  <Badge variant="outline" className="text-xs mt-1">
                    {payment.method ?? "—"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
