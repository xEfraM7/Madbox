"use client"

import { useQuery } from "@tanstack/react-query"
import { Calendar, Loader2 } from "lucide-react"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import {
  getRoutineForToday,
  getMyWodLogsForRoutine,
} from "@/lib/actions/wod-logs"
import { CONDITIONING_SCORE_TYPE } from "@/lib/constants/routine-blocks"
import { WodBlockCard } from "./WodBlockCard"
import { InfoBlockCard } from "./InfoBlockCard"
import { useEffect, useState } from "react"
import { createClient } from "@/utils/supabase/client"

export default function PortalWodMainComponent() {
  const [me, setMe] = useState<{
    memberId: string
    gender: "male" | "female"
  } | null>(null)
  const [meLoading, setMeLoading] = useState(true)

  useEffect(() => {
    const run = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setMeLoading(false); return }
        const { data } = await supabase
          .from("members")
          .select("id, gender")
          .eq("auth_user_id", user.id)
          .maybeSingle()
        if (data?.id) {
          setMe({
            memberId: data.id,
            gender: (data.gender as "male" | "female") ?? "male",
          })
        }
      } finally {
        setMeLoading(false)
      }
    }
    run()
  }, [])

  const { data: routine, isLoading: routineLoading } = useQuery({
    queryKey: ["routine-today", me?.memberId],
    queryFn: getRoutineForToday,
    staleTime: 60 * 1000,
    enabled: !!me?.memberId,
  })

  const { data: myLogs = [] } = useQuery({
    queryKey: ["my-wod-logs", me?.memberId, routine?.id],
    queryFn: () => (routine ? getMyWodLogsForRoutine(routine.id) : Promise.resolve([])),
    staleTime: 60 * 1000,
    enabled: !!routine?.id,
  })

  const isLoading = meLoading || routineLoading

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!me) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center space-y-3">
        <p className="text-sm font-medium">No tienes un perfil de miembro asignado.</p>
        <p className="text-xs text-muted-foreground">Contacta al admin del gimnasio.</p>
      </div>
    )
  }

  if (!routine) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">WOD del día</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
          </p>
        </div>
        <div className="rounded-xl border border-dashed p-10 text-center space-y-3">
          <Calendar className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="text-sm font-medium">No hay rutina programada para hoy.</p>
          <p className="text-xs text-muted-foreground">Vuelve mañana o revisa el calendario en /portal/rutinas.</p>
        </div>
      </div>
    )
  }

  const sortedBlocks = [...routine.blocks].sort((a, b) => a.order - b.order)
  const registrableCount = sortedBlocks.filter((b) => CONDITIONING_SCORE_TYPE[b.type]).length
  const dateLabel = format(parseISO(routine.date + "T00:00:00"), "EEEE, d 'de' MMMM", { locale: es })

  const logsByBlockId = new Map(myLogs.map((l) => [l.block_id, l]))

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
          {dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)}
        </p>
        <h1 className="text-2xl font-bold tracking-tight mt-0.5">
          {routine.name ?? "WOD del día"}
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          {registrableCount} {registrableCount === 1 ? "bloque registrable" : "bloques registrables"}
        </p>
      </div>

      <div className="space-y-3">
        {sortedBlocks.map((block) =>
          CONDITIONING_SCORE_TYPE[block.type] ? (
            <WodBlockCard
              key={block.id}
              routineId={routine.id}
              block={block}
              myLog={logsByBlockId.get(block.id) ?? null}
              defaultGender={me.gender}
              myMemberId={me.memberId}
            />
          ) : (
            <InfoBlockCard key={block.id} block={block} />
          ),
        )}
      </div>
    </div>
  )
}
