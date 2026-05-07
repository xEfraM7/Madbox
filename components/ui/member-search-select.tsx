"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { Check, ChevronDown, Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

type MemberStatus = "active" | "expired" | "frozen"

interface Member {
  id: string
  name: string
  email?: string
  status?: MemberStatus | null
}

interface MemberSearchSelectProps {
  members: Member[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
}

const STATUS_LABEL: Record<MemberStatus, string> = {
  active: "Activo",
  expired: "Vencido",
  frozen: "Congelado",
}

const STATUS_CLASS: Record<MemberStatus, string> = {
  active: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
  expired: "bg-red-500/10 text-red-500 border-red-500/30",
  frozen: "bg-blue-500/10 text-blue-500 border-blue-500/30",
}

function StatusBadge({ status }: { status: MemberStatus }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold border tabular-nums",
        STATUS_CLASS[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

export function MemberSearchSelect({
  members,
  value,
  onValueChange,
  placeholder = "Selecciona un cliente",
}: MemberSearchSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [activeIdx, setActiveIdx] = useState(-1)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listboxId = useId()

  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => a.name.localeCompare(b.name, "es")),
    [members],
  )

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return sortedMembers
    return sortedMembers.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q),
    )
  }, [sortedMembers, search])

  const selectedMember = useMemo(
    () => members.find((m) => m.id === value),
    [members, value],
  )

  // Cerrar al click fuera
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  // Focus al input al abrir; reset al cerrar
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 30)
      return () => clearTimeout(t)
    }
    setSearch("")
    setActiveIdx(-1)
  }, [open])

  // Reset índice activo cuando cambia el filtro
  useEffect(() => {
    setActiveIdx(filteredMembers.length > 0 ? 0 : -1)
  }, [filteredMembers])

  // Scroll automático del item activo
  useEffect(() => {
    if (activeIdx < 0 || !listRef.current) return
    const el = listRef.current.children[activeIdx] as HTMLElement | undefined
    el?.scrollIntoView({ block: "nearest" })
  }, [activeIdx])

  const select = (id: string) => {
    onValueChange(id)
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, filteredMembers.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === "Home") {
      e.preventDefault()
      setActiveIdx(0)
    } else if (e.key === "End") {
      e.preventDefault()
      setActiveIdx(filteredMembers.length - 1)
    } else if (e.key === "Enter") {
      e.preventDefault()
      const m = filteredMembers[activeIdx]
      if (m) select(m.id)
    } else if (e.key === "Escape") {
      e.preventDefault()
      setOpen(false)
    }
  }

  const triggerLabel = selectedMember?.name ?? placeholder
  const activeOptionId =
    activeIdx >= 0 && filteredMembers[activeIdx]
      ? `${listboxId}-opt-${filteredMembers[activeIdx].id}`
      : undefined

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full justify-between font-normal",
          !selectedMember && "text-muted-foreground",
        )}
      >
        <span className="truncate">{triggerLabel}</span>
        <span className="flex shrink-0 items-center gap-2">
          {selectedMember?.status && <StatusBadge status={selectedMember.status} />}
          <ChevronDown
            className={cn(
              "h-4 w-4 opacity-50 transition-transform",
              open && "rotate-180",
            )}
          />
        </span>
      </Button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              ref={inputRef}
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Buscar por nombre o email…"
              role="combobox"
              aria-expanded
              aria-controls={listboxId}
              aria-activedescendant={activeOptionId}
              aria-label="Buscar cliente"
              className="h-8 border-0 bg-transparent p-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("")
                  inputRef.current?.focus()
                }}
                className="shrink-0 text-muted-foreground hover:text-foreground"
                aria-label="Limpiar búsqueda"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="border-b border-border bg-muted/20 px-3 py-1.5 text-[11px] text-muted-foreground">
            {filteredMembers.length === sortedMembers.length
              ? `${sortedMembers.length} clientes`
              : `${filteredMembers.length} de ${sortedMembers.length} clientes`}
          </div>

          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label="Lista de clientes"
            className="max-h-72 overflow-y-auto py-1"
          >
            {filteredMembers.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm italic text-muted-foreground">
                No se encontraron clientes
              </li>
            ) : (
              filteredMembers.map((m, idx) => {
                const isSelected = m.id === value
                const isActive = idx === activeIdx
                return (
                  <li
                    key={m.id}
                    id={`${listboxId}-opt-${m.id}`}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => select(m.id)}
                    onMouseEnter={() => setActiveIdx(idx)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 px-3 py-2.5 text-sm",
                      isActive && "bg-accent",
                      isSelected && "font-medium",
                    )}
                  >
                    <Check
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isSelected ? "text-primary opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{m.name}</p>
                      {m.email && (
                        <p className="truncate text-xs text-muted-foreground">
                          {m.email}
                        </p>
                      )}
                    </div>
                    {m.status && <StatusBadge status={m.status} />}
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
