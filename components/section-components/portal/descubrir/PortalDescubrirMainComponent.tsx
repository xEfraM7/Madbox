"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Loader2, Search, Users } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { getDiscoverableMembers } from "@/lib/actions/records"
import { RankingStrip } from "./RankingStrip"
import { MemberCard } from "./MemberCard"
import { MemberDetailModal } from "./MemberDetailModal"

export default function PortalDescubrirMainComponent() {
  const [search, setSearch] = useState("")
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["discoverable-members"],
    queryFn: () => getDiscoverableMembers(),
    staleTime: 60 * 1000,
  })

  const filtered = useMemo(() => {
    if (!search.trim()) return members
    const q = search.trim().toLowerCase()
    return members.filter((m) => m.name.toLowerCase().includes(q))
  }, [members, search])

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Descubrir</h1>
        <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
          Conoce a la comunidad de Madbox
        </p>
      </div>

      <RankingStrip />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder="Buscar miembro..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              {search.trim()
                ? "No se encontraron miembros con ese nombre."
                : "Aún no hay miembros visibles en Descubrir."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Comunidad ({filtered.length} {filtered.length === 1 ? "miembro" : "miembros"})
          </p>
          <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((m) => (
              <MemberCard
                key={m.id}
                member={m}
                onClick={() => setSelectedMemberId(m.id)}
              />
            ))}
          </div>
        </div>
      )}

      <MemberDetailModal
        memberId={selectedMemberId}
        onClose={() => setSelectedMemberId(null)}
      />
    </div>
  )
}
