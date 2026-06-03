"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CalendarDays, Flame } from "lucide-react"
import { cn } from "@/lib/utils"

const tabs = [
  { name: "Rutinas", href: "/portal/rutinas", icon: CalendarDays },
  { name: "WOD", href: "/portal/wod", icon: Flame },
]

export function EntrenarTabs() {
  const pathname = usePathname()

  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-card p-1">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const active = pathname.startsWith(tab.href)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <Icon className="h-4 w-4" />
            {tab.name}
          </Link>
        )
      })}
    </div>
  )
}
