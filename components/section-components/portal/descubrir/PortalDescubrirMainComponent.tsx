"use client"

import { useMemo, useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { Loader2, Search, Users } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { getDiscoverableMembers } from "@/lib/actions/records"
import { getMyProfile } from "@/lib/actions/portal"
import { RankingStrip } from "./RankingStrip"
import { MemberCard } from "./MemberCard"
import { MemberDetailModal } from "./MemberDetailModal"
import type { Gender } from "@/lib/constants/athlete"

export default function PortalDescubrirMainComponent() {
  const [search, setSearch] = useState("")
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [tab, setTab] = useState<Gender>("male")

  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: getMyProfile,
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (profile?.gender === "male" || profile?.gender === "female") {
      setTab(profile.gender)
    }
  }, [profile?.gender])

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["discoverable-members", tab],
    queryFn: () => getDiscoverableMembers({ gender: tab }),
    staleTime: 60 * 1000,
  })

  const filtered = useMemo(() => {
    if (!search.trim()) return members
    const q = search.trim().toLowerCase()
    return members.filter((m) => m.name.toLowerCase().includes(q))
  }, [members, search])

  const userHasNoGender = profile && !profile.gender

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Descubrir</h1>
        <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
          Conoce a la comunidad de Madbox
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Gender)}>
        <TabsList className="grid w-full sm:w-auto grid-cols-2">
          <TabsTrigger value="male">Hombres</TabsTrigger>
          <TabsTrigger value="female">Mujeres</TabsTrigger>
        </TabsList>

        {(["male", "female"] as Gender[]).map((g) => (
          <TabsContent key={g} value={g} className="space-y-5 sm:space-y-6 mt-5 sm:mt-6">
            <RankingStrip gender={g} />

            {userHasNoGender && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="py-3 text-xs sm:text-sm text-muted-foreground">
                  Completa tu género en{" "}
                  <a className="text-primary underline" href="/portal/perfil">tu perfil</a>{" "}
                  para aparecer en Descubrir.
                </CardContent>
              </Card>
            )}

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

            {isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <Card>
                <CardContent className="py-12 flex flex-col items-center gap-3 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Users className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {search.trim()
                      ? "No se encontraron miembros con ese nombre."
                      : g === "male"
                        ? "Aún no hay hombres visibles en Descubrir."
                        : "Aún no hay mujeres visibles en Descubrir."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  {g === "male" ? "Comunidad masculina" : "Comunidad femenina"} (
                  {filtered.length} {filtered.length === 1 ? "miembro" : "miembros"})
                </p>
                <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filtered.map((m) => (
                    <MemberCard
                      key={m.id}
                      member={m}
                      gender={g}
                      onClick={() => setSelectedMemberId(m.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <MemberDetailModal
        memberId={selectedMemberId}
        onClose={() => setSelectedMemberId(null)}
      />
    </div>
  )
}
