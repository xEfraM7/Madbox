"use client"

import { useQuery } from "@tanstack/react-query"
import { DashboardLayout } from "@/components/shared/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Users, DollarSign, CreditCard, TrendingUp, Calendar, Activity, ArrowUpRight, ArrowDownRight, Wallet, Banknote, Bitcoin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { useState, useEffect } from "react"
import { getDashboardStats, getRecentActivity, getUpcomingPayments, getMonthlyRevenueChart } from "@/lib/actions/dashboard"
import { getAdmin } from "@/lib/actions/auth"
import { getFundsWithConversion } from "@/lib/actions/funds"
import { ActivityLogModal } from "@/components/shared/activity-log-modal"

export default function DashboardMainComponent() {
  const [selectedRate, setSelectedRate] = useState<"bcv" | "usdt" | "cash" | "custom">("bcv")
  const [activityModalOpen, setActivityModalOpen] = useState(false)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  const { data: admin } = useQuery({
    queryKey: ["current-admin"],
    queryFn: getAdmin,
  })

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: getDashboardStats,
    refetchInterval: 30000, // Refrescar cada 30 segundos
  })

  const { data: activities = [], isLoading: loadingActivities } = useQuery({
    queryKey: ["recent-activity"],
    queryFn: getRecentActivity,
    refetchInterval: 10000, // Refrescar cada 10 segundos
  })

  const { data: upcomingPayments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ["upcoming-payments"],
    queryFn: getUpcomingPayments,
  })

  const { data: revenueChart = [] } = useQuery({
    queryKey: ["revenue-chart"],
    queryFn: getMonthlyRevenueChart,
  })

  const { data: fundsData, isLoading: loadingFunds } = useQuery({
    queryKey: ["funds"],
    queryFn: getFundsWithConversion,
    refetchInterval: 30000, // Refrescar cada 30 segundos
  })

  const formatCurrency = (amount: number) => {
    if (!isClient) return "$0"
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const formatNumber = (amount: number, decimals = 2) => {
    if (!isClient) return "0"
    return amount.toLocaleString("es-ES", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  }

  const getRateValue = () => {
    const bcvRate = fundsData?.rates.bcv || 1
    const usdtRate = fundsData?.rates.usdt || 1
    const customRate = fundsData?.rates.custom || 1
    switch (selectedRate) {
      case "bcv": return bcvRate
      case "usdt": return usdtRate
      case "cash": return usdtRate
      case "custom": return customRate
      default: return bcvRate
    }
  }

  const calculateTotalInUsd = () => {
    const bsBalance = fundsData?.funds.bs.balance || 0
    const usdCash = fundsData?.funds.usdCash.balance || 0
    const usdt = fundsData?.funds.usdt.balance || 0
    const rate = getRateValue()
    
    const bsInUsd = bsBalance / rate
    return bsInUsd + usdCash + usdt
  }

  const calculateMonthlyRevenueInUsd = () => {
    if (!stats?.monthlyRevenueByType) {
      return stats?.monthlyRevenue || 0
    }
    
    const { bs, usdCash, usdt } = stats.monthlyRevenueByType
    const rate = getRateValue()
    
    const bsInUsd = (bs || 0) / rate
    return bsInUsd + (usdCash || 0) + (usdt || 0)
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-balance">
            Bienvenido, {admin?.name || "Admin"}
          </h1>
          <p className="text-muted-foreground mt-2">Aquí está el resumen de tu gimnasio hoy</p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Miembros Activos</CardTitle>
              <Users className="h-5 w-5 text-blue-500" />
            </CardHeader>
            <CardContent>
              {loadingStats ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <>
                  <div className="text-3xl font-bold">{stats?.activeMembers || 0}</div>
                  <div className="flex items-center text-xs text-muted-foreground mt-1">
                    {(stats?.membersGrowth || 0) >= 0 ? (
                      <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3 text-red-500 mr-1" />
                    )}
                    <span className={(stats?.membersGrowth || 0) >= 0 ? "text-green-500" : "text-red-500"}>
                      {stats?.membersGrowth || 0}%
                    </span>
                    <span className="ml-1">vs mes anterior</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Ingresos del Mes</CardTitle>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-6 text-xs px-2">
                    {selectedRate === "bcv" ? "BCV" : selectedRate === "usdt" ? "USDT" : selectedRate === "custom" ? "Custom" : "Efectivo"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setSelectedRate("bcv")}>Tasa BCV</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSelectedRate("usdt")}>Tasa USDT</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSelectedRate("cash")}>Tasa Efectivo</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSelectedRate("custom")}>Tasa Personalizada</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent>
              {loadingStats || loadingFunds ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-3xl font-bold text-green-500">{formatCurrency(calculateMonthlyRevenueInUsd())}</div>
                  <div className="flex items-center text-xs text-muted-foreground mt-1">
                    {(stats?.revenueGrowth || 0) >= 0 ? (
                      <ArrowUpRight className="h-3 w-3 text-green-500 mr-1" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3 text-red-500 mr-1" />
                    )}
                    <span className={(stats?.revenueGrowth || 0) >= 0 ? "text-green-500" : "text-red-500"}>
                      {stats?.revenueGrowth || 0}%
                    </span>
                    <span className="ml-1">vs mes anterior</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Planes Activos</CardTitle>
              <CreditCard className="h-5 w-5 text-purple-500" />
            </CardHeader>
            <CardContent>
              {loadingStats ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-3xl font-bold">{stats?.activePlans || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats?.specialClasses || 0} clases especiales
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Tasa de Retención</CardTitle>
              <TrendingUp className="h-5 w-5 text-orange-500" />
            </CardHeader>
            <CardContent>
              {loadingStats ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-3xl font-bold">{stats?.renewalRate || 0}%</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats?.activeMembers || 0} de {stats?.totalMembers || 0} miembros
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Fondos / Bolsos */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <Card className="border-blue-500/20 bg-blue-500/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Bolso Bolívares</CardTitle>
              <Banknote className="h-5 w-5 text-blue-500" />
            </CardHeader>
            <CardContent>
              {loadingFunds ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    Bs. {formatNumber(fundsData?.funds.bs.balance || 0, 2)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    ≈ ${(fundsData?.funds.bs.inUsd || 0).toFixed(2)} USD (Tasa BCV: {fundsData?.rates.bcv})
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-green-500/20 bg-green-500/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Bolso Dólares Efectivo</CardTitle>
              <DollarSign className="h-5 w-5 text-green-500" />
            </CardHeader>
            <CardContent>
              {loadingFunds ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    ${formatNumber(fundsData?.funds.usdCash.balance || 0, 2)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tasa efectivo: Bs. {fundsData?.rates.cash}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-orange-500/20 bg-orange-500/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Bolso USDT</CardTitle>
              <Bitcoin className="h-5 w-5 text-orange-500" />
            </CardHeader>
            <CardContent>
              {loadingFunds ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    ${formatNumber(fundsData?.funds.usdt.balance || 0, 2)} USDT
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Tasa USDT: Bs. {fundsData?.rates.usdt}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Total en USD */}
        <Card className="border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Consolidado en USD</CardTitle>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    Tasa {selectedRate === "bcv" ? "BCV" : selectedRate === "usdt" ? "USDT" : selectedRate === "custom" ? "Custom" : "Efectivo"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setSelectedRate("bcv")}>Tasa BCV</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSelectedRate("usdt")}>Tasa USDT</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSelectedRate("cash")}>Tasa Efectivo</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSelectedRate("custom")}>Tasa Personalizada</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Wallet className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            {loadingFunds ? (
              <Skeleton className="h-10 w-32" />
            ) : (
              <>
                <div className="text-4xl font-bold text-primary">
                  ${formatNumber(calculateTotalInUsd(), 2)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Bs convertidos a tasa {selectedRate === "bcv" ? "BCV" : selectedRate === "usdt" ? "USDT" : "Efectivo"}: {getRateValue().toFixed(2)}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Revenue Chart & Activity */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          {/* Revenue Chart */}
          <Card className="col-span-full lg:col-span-4">
            <CardHeader>
              <CardTitle>Ingresos Mensuales</CardTitle>
              <CardDescription>Últimos 6 meses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[200px] flex items-end justify-between gap-2">
                {revenueChart.map((item, index) => {
                  const maxRevenue = Math.max(...revenueChart.map((r) => r.revenue), 1)
                  const height = (item.revenue / maxRevenue) * 100
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center gap-2">
                      <div className="w-full bg-muted rounded-t relative" style={{ height: `${Math.max(height, 5)}%` }}>
                        <div
                          className="absolute inset-0 bg-primary rounded-t transition-all hover:bg-primary/80"
                          style={{ height: "100%" }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground capitalize">{item.month}</span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="col-span-full lg:col-span-3">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Actividad Reciente
                  </CardTitle>
                  <CardDescription>Últimas transacciones y eventos</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => setActivityModalOpen(true)}>
                  Ver todo
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingActivities ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : activities.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No hay actividad reciente</p>
              ) : (
                <div className="space-y-4">
                  {activities.map((activity, index) => (
                    <div key={index} className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          activity.type === "payment" ? "bg-green-500" :
                          activity.type === "member" ? "bg-blue-500" : "bg-purple-500"
                        }`} />
                        <div>
                          <p className="text-sm font-medium">{activity.user}</p>
                          <p className="text-xs text-muted-foreground">{activity.action}</p>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">{activity.time}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Upcoming Payments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Próximos Vencimientos
            </CardTitle>
            <CardDescription>Miembros con pagos próximos a vencer</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingPayments ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : upcomingPayments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No hay vencimientos próximos</p>
            ) : (
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                {upcomingPayments.map((payment, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="min-w-0 flex-1 mr-2">
                      <p className="text-sm font-medium truncate">{payment.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{payment.plan}</p>
                    </div>
                    <Badge variant={payment.days <= 0 ? "destructive" : payment.days <= 3 ? "secondary" : "outline"} className="shrink-0">
                      {payment.days <= 0 ? "Vencido" : `${payment.days}d`}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ActivityLogModal open={activityModalOpen} onOpenChange={setActivityModalOpen} />
    </DashboardLayout>
  )
}
