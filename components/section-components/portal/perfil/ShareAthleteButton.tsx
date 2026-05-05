"use client"

import { useRef, useState } from "react"
import { Loader2, Share2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useShareAthleteCard } from "@/lib/hooks/use-share-athlete-card"
import { AthleteCard } from "./AthleteCard"

interface Props {
  enabled: boolean
  disabledReason?: string
}

export function ShareAthleteButton({ enabled, disabledReason }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [busy, setBusy] = useState(false)
  const { cardData, fetchCardData, clearCardData, captureAndShare, isFetching } = useShareAthleteCard()

  async function handleClick() {
    if (busy) return
    setBusy(true)
    try {
      const data = await fetchCardData()
      await new Promise((r) => requestAnimationFrame(() => r(null)))
      await new Promise((r) => requestAnimationFrame(() => r(null)))
      if (!ref.current) throw new Error("No se pudo preparar la ficha")
      await captureAndShare(ref.current, data.name)
    } catch (e) {
      toast.error(
        e instanceof Error
          ? e.message
          : "No pudimos generar la imagen. Intenta de nuevo.",
      )
    } finally {
      clearCardData()
      setBusy(false)
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="default"
        size="sm"
        className="gap-2 w-full"
        onClick={handleClick}
        disabled={!enabled || busy || isFetching}
        title={!enabled ? disabledReason : undefined}
      >
        {busy || isFetching ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Share2 className="h-4 w-4" />
        )}
        Compartir mi ficha
      </Button>
      {cardData && <AthleteCard data={cardData} innerRef={ref} />}
    </>
  )
}
