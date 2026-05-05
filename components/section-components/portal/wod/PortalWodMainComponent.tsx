"use client"

import { Construction } from "lucide-react"

export default function PortalWodMainComponent() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">WOD</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Registro de WODs y leaderboard.
        </p>
      </div>
      <div className="rounded-xl border border-dashed p-10 text-center space-y-3">
        <Construction className="h-10 w-10 mx-auto text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-medium">Sección en construcción</p>
          <p className="text-xs text-muted-foreground">
            Estamos migrando el modelo de rutinas. El registro de WODs volverá pronto.
          </p>
        </div>
      </div>
    </div>
  )
}
