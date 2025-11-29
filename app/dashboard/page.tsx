import { DashboardLayout } from "@/components/dashboard-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, DollarSign, CreditCard, TrendingUp } from "lucide-react"

export default function DashboardPage() {
  const stats = [
    {
      title: "Usuarios Activos",
      value: "284",
      description: "+12% desde el mes pasado",
      icon: Users,
      color: "text-blue-500",
    },
    {
      title: "Ingresos del Mes",
      value: "$45,231",
      description: "+20.1% desde el mes pasado",
      icon: DollarSign,
      color: "text-green-500",
    },
    {
      title: "Planes Vigentes",
      value: "12",
      description: "4 planes destacados",
      icon: CreditCard,
      color: "text-purple-500",
    },
    {
      title: "Tasa de Renovación",
      value: "89%",
      description: "+4% desde el mes pasado",
      icon: TrendingUp,
      color: "text-orange-500",
    },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Bienvenida */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-balance">Bienvenido de vuelta, Admin</h1>
          <p className="text-muted-foreground mt-2">Aquí está el resumen de tu gimnasio hoy</p>
        </div>

        {/* Stats grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon
            return (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Activity overview */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-full lg:col-span-4">
            <CardHeader>
              <CardTitle>Actividad Reciente</CardTitle>
              <CardDescription>Últimas transacciones y eventos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  {
                    user: "Carlos Rodríguez",
                    action: "Renovó plan Premium",
                    time: "Hace 2 minutos",
                  },
                  {
                    user: "María García",
                    action: "Nuevo registro",
                    time: "Hace 15 minutos",
                  },
                  {
                    user: "Juan López",
                    action: "Pago de mensualidad",
                    time: "Hace 1 hora",
                  },
                  {
                    user: "Ana Martínez",
                    action: "Congeló mensualidad",
                    time: "Hace 3 horas",
                  },
                  {
                    user: "Pedro Sánchez",
                    action: "Pago de clase especial",
                    time: "Hace 5 horas",
                  },
                ].map((activity, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <div>
                        <p className="text-sm font-medium">{activity.user}</p>
                        <p className="text-xs text-muted-foreground">{activity.action}</p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">{activity.time}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-full lg:col-span-3">
            <CardHeader>
              <CardTitle>Próximos Vencimientos</CardTitle>
              <CardDescription>Pagos que vencen pronto</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { name: "Luis Hernández", plan: "Plan Básico", days: 2 },
                  { name: "Sofia Torres", plan: "Plan Premium", days: 3 },
                  { name: "Diego Ramírez", plan: "Plan Mensual", days: 5 },
                  { name: "Carmen Vega", plan: "Plan Básico", days: 7 },
                ].map((upcoming, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between border-b border-border pb-3 last:border-0 last:pb-0"
                  >
                    <div>
                      <p className="text-sm font-medium">{upcoming.name}</p>
                      <p className="text-xs text-muted-foreground">{upcoming.plan}</p>
                    </div>
                    <span className="text-xs font-medium text-orange-500">{upcoming.days} días</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
