"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { cn } from "@/lib/utils"
import { ShoppingBag } from "lucide-react"
import { getStoreProducts, getActiveCategories } from "@/lib/actions/products"
import { getExchangeRates } from "@/lib/actions/funds"
import { getGymSettings } from "@/lib/actions/settings"
import { ProductCard } from "./ProductCard"

const ALL = "all"

export function PortalTiendaMainComponent() {
  const [category, setCategory] = useState(ALL)

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["store-products"],
    queryFn: getStoreProducts,
  })
  const { data: categories = [] } = useQuery({
    queryKey: ["store-categories"],
    queryFn: getActiveCategories,
  })
  const { data: exchangeRates = [] } = useQuery({
    queryKey: ["exchange-rates"],
    queryFn: getExchangeRates,
  })
  const { data: settings } = useQuery({
    queryKey: ["gym-settings"],
    queryFn: getGymSettings,
  })

  const bcvRate = exchangeRates.find((r: any) => r.type === "BCV")?.rate || 0
  const whatsapp = settings?.whatsapp || null

  const filtered = category === ALL ? products : products.filter((p: any) => p.category_id === category)

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <ShoppingBag className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Tienda</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Productos disponibles en el gimnasio
          </p>
        </div>
      </div>

      {categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-3 px-3 sm:-mx-1 sm:px-1 scrollbar-hide">
          <CategoryChip label="Todos" active={category === ALL} onClick={() => setCategory(ALL)} />
          {categories.map((c: any) => (
            <CategoryChip key={c.id} label={c.name} active={category === c.id} onClick={() => setCategory(c.id)} />
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border overflow-hidden">
              <div className="aspect-square bg-muted animate-pulse" />
              <div className="p-3 space-y-2">
                <div className="h-2.5 bg-muted rounded w-1/2 animate-pulse" />
                <div className="h-3.5 bg-muted rounded w-3/4 animate-pulse" />
                <div className="h-4 bg-muted rounded w-1/3 animate-pulse" />
                <div className="h-9 bg-muted rounded-md mt-1 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16 sm:py-20">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
            <ShoppingBag className="h-8 w-8 text-muted-foreground opacity-60" />
          </div>
          <p className="font-medium">Aún no hay productos disponibles</p>
          <p className="text-sm text-muted-foreground mt-1">Vuelve pronto.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filtered.map((product: any) => (
            <ProductCard key={product.id} product={product} bcvRate={bcvRate} whatsapp={whatsapp} />
          ))}
        </div>
      )}
    </div>
  )
}

function CategoryChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium border transition-colors cursor-pointer",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-primary/40"
      )}
    >
      {label}
    </button>
  )
}
