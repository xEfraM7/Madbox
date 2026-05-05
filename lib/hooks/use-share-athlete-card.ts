"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { toBlob } from "html-to-image"
import { toast } from "sonner"
import { getMyAthleteCardData, type AthleteCardData } from "@/lib/actions/portal"

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)
}

async function waitForImagesLoaded(node: HTMLElement): Promise<void> {
  const imgs = Array.from(node.querySelectorAll("img"))
  await Promise.all(
    imgs.map((img) => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve()
      return new Promise<void>((resolve) => {
        img.onload = () => resolve()
        img.onerror = () => resolve()
      })
    }),
  )
  await new Promise((r) => setTimeout(r, 60))
}

export function useShareAthleteCard() {
  const [cardData, setCardData] = useState<AthleteCardData | null>(null)

  const fetchData = useMutation({
    mutationFn: getMyAthleteCardData,
  })

  async function captureAndShare(node: HTMLElement, name: string): Promise<void> {
    await waitForImagesLoaded(node)

    const blob = await toBlob(node, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: "#0a0a0a",
    })

    if (!blob) throw new Error("No se pudo generar la imagen")

    const filename = `madbox-ficha-${slugify(name) || "atleta"}.png`
    const file = new File([blob], filename, { type: "image/png" })

    const canShare =
      typeof navigator !== "undefined" &&
      typeof (navigator as { canShare?: (data: { files: File[] }) => boolean }).canShare === "function" &&
      (navigator as { canShare?: (data: { files: File[] }) => boolean }).canShare?.({ files: [file] })

    if (canShare) {
      try {
        await (navigator as Navigator & { share: (d: { files: File[]; title: string }) => Promise<void> }).share({ files: [file], title: "Mi ficha Madbox" })
        toast.success("¡Compartido!")
        return
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return
      }
    }

    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success("Imagen descargada — compártela donde quieras")
  }

  return {
    cardData,
    fetchCardData: async () => {
      const d = await fetchData.mutateAsync()
      setCardData(d)
      return d
    },
    clearCardData: () => setCardData(null),
    captureAndShare,
    isFetching: fetchData.isPending,
  }
}
