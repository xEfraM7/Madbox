"use client"

import Link from "next/link"
import { ShoppingBag, ArrowRight } from "lucide-react"

// Acceso a la Tienda desde la home: tira compacta, poco invasiva pero
// resaltada con el dorado de marca para que destaque a primera vista.
export function TiendaPromoCard() {
  return (
    <Link
      href="/portal/tienda"
      aria-label="Ver la tienda del gimnasio"
      className="group relative flex items-center gap-3 overflow-hidden rounded-xl border border-primary/25 bg-primary/[0.06] px-3.5 py-3 transition-colors hover:bg-primary/[0.1] active:bg-primary/[0.14]"
    >
      {/* Glow de esquina, da profundidad sin gritar */}
      <div className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-primary/15 blur-2xl" />

      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <ShoppingBag className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-semibold leading-tight">Tienda Madbox</p>
          <span className="rounded-full bg-primary px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
            Nuevo
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          Suplementos, ropa y accesorios del gym
        </p>
      </div>

      <ArrowRight className="h-4 w-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" />
    </Link>
  )
}
