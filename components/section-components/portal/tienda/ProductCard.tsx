"use client"

import { useState } from "react"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ShoppingBag, MessageCircle, Star } from "lucide-react"
import { cn } from "@/lib/utils"

interface ProductCardProps {
  product: any
  bcvRate: number
  whatsapp: string | null
}

export function ProductCard({ product, bcvRate, whatsapp }: ProductCardProps) {
  const [imgError, setImgError] = useState(false)
  const price = Number(product.price)
  const bs = bcvRate > 0 ? price * bcvRate : null
  const mainImage = product.images?.[0]
  const available = product.in_stock

  const waLink = whatsapp
    ? `https://wa.me/${whatsapp.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`Hola, me interesa: ${product.name} ($${price.toFixed(2)})`)}`
    : null

  return (
    <Card
      className={cn(
        "group overflow-hidden flex flex-col gap-0 py-0 transition-colors hover:border-primary/40",
        product.featured && "border-primary/40 ring-1 ring-primary/20",
        !available && "opacity-70"
      )}
    >
      <div className="relative aspect-square bg-muted overflow-hidden">
        {mainImage && !imgError ? (
          <Image
            src={mainImage}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, 33vw"
            className={cn(
              "object-cover transition-transform duration-300 group-hover:scale-[1.04]",
              !available && "grayscale"
            )}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-muted-foreground">
            <ShoppingBag className="h-10 w-10 opacity-40" />
          </div>
        )}

        {/* Sutil degradado inferior para anclar las insignias y dar profundidad */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-linear-to-t from-black/30 to-transparent" />

        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {product.featured && (
            <Badge className="bg-primary text-primary-foreground gap-1 w-fit shadow-sm">
              <Star className="h-3 w-3 fill-current" />
              Destacado
            </Badge>
          )}
          {!available && (
            <Badge variant="secondary" className="w-fit">
              Agotado
            </Badge>
          )}
        </div>
      </div>

      <CardContent className="p-3 flex flex-col flex-1">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
          {product.product_categories?.name || "Producto"}
        </p>
        <h3 className="font-semibold leading-tight line-clamp-2 mt-0.5">{product.name}</h3>
        {product.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{product.description}</p>
        )}

        <div className="mt-2 flex items-baseline gap-2 flex-wrap">
          <span className="text-lg font-bold text-green-500 tabular-nums">${price.toFixed(2)}</span>
          {bs !== null && (
            <span className="text-xs text-blue-400 tabular-nums">
              ≈ Bs {bs.toLocaleString("es-VE", { maximumFractionDigits: 0 })}
            </span>
          )}
        </div>

        <div className="mt-auto pt-3">
          {available && waLink ? (
            <Button
              asChild
              className="w-full gap-2 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white transition-colors"
            >
              <a href={waLink} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4" />
                Pedir por WhatsApp
              </a>
            </Button>
          ) : (
            <Button className="w-full" variant="secondary" disabled>
              {available ? "Contacto no disponible" : "Agotado"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
