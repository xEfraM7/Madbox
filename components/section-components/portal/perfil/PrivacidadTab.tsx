"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  getMyVisibility,
  updateMyVisibility,
  type VisibilitySettings,
} from "@/lib/actions/records"

const TOGGLES: Array<{
  key: keyof VisibilitySettings
  title: string
  desc: string
  isMaster?: boolean
}> = [
  {
    key: "discoverable",
    title: "Aparecer en Descubrir",
    desc: "Que otros miembros te vean en la sección Descubrir.",
    isMaster: true,
  },
  {
    key: "show_avatar",
    title: "Mostrar avatar",
    desc: "Tu foto aparecerá en tu card. Si no, se muestran tus iniciales.",
  },
  {
    key: "show_plan",
    title: "Mostrar plan",
    desc: "Otros verán a qué plan estás suscrito.",
  },
  {
    key: "show_rms",
    title: "Mostrar mis RMs",
    desc: "Tus marcas serán visibles en tu card y contarán para los rankings.",
  },
]

export function PrivacidadTab() {
  const queryClient = useQueryClient()

  const { data: visibility, isLoading } = useQuery({
    queryKey: ["my-visibility"],
    queryFn: getMyVisibility,
    staleTime: 5 * 60 * 1000,
  })

  const mutation = useMutation({
    mutationFn: (patch: Partial<VisibilitySettings>) => updateMyVisibility(patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-visibility"] })
      toast.success("Privacidad actualizada")
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Error al actualizar")
    },
  })

  if (isLoading || !visibility) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <Card>
      <CardContent className="pt-5 sm:pt-6 divide-y divide-border">
        {TOGGLES.map((t, i) => {
          const checked = visibility[t.key]
          const masterOff = !visibility.discoverable && !t.isMaster
          return (
            <div
              key={t.key}
              className={cn(
                "flex items-start justify-between gap-3 sm:gap-4 py-4",
                i === 0 && "pt-0",
                masterOff && "opacity-50",
              )}
            >
              <div className="min-w-0 flex-1">
                <Label
                  htmlFor={`tog-${t.key}`}
                  className={cn("text-sm font-medium", masterOff && "cursor-not-allowed")}
                >
                  {t.title}
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
                {masterOff && (
                  <p className="text-[11px] text-muted-foreground mt-1 italic">
                    Activa &quot;Aparecer en Descubrir&quot; primero.
                  </p>
                )}
              </div>
              <Switch
                id={`tog-${t.key}`}
                checked={checked}
                disabled={masterOff || mutation.isPending}
                onCheckedChange={(next) => mutation.mutate({ [t.key]: next })}
              />
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
