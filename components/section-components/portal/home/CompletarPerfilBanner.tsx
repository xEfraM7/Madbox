"use client"

import Link from "next/link"
import { UserCog } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export function CompletarPerfilBanner() {
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <UserCog className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">Completa tu perfil de atleta</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Necesitas tu género para aparecer en Descubrir y compartir tu ficha.
            </p>
          </div>
        </div>
        <Link href="/portal/perfil" className="shrink-0">
          <Button size="sm" className="w-full sm:w-auto">
            Completar
          </Button>
        </Link>
      </CardContent>
    </Card>
  )
}
