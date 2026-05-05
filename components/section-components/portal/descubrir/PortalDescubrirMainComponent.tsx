"use client"

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { getMyProfile } from "@/lib/actions/portal"
import { RankingStrip } from "./RankingStrip"
import { Top10Leaderboard } from "./Top10Leaderboard"
import { MemberDetailModal } from "./MemberDetailModal"
import type { Gender } from "@/lib/constants/athlete"

export default function PortalDescubrirMainComponent() {
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

  const userHasNoGender = profile && !profile.gender

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Descubrir</h1>
        <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
          Top 10 por Grand Total — comunidad Madbox
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Gender)}>
        <TabsList className="grid w-full sm:w-auto grid-cols-2">
          <TabsTrigger value="male">Hombres</TabsTrigger>
          <TabsTrigger value="female">Mujeres</TabsTrigger>
        </TabsList>

        {(["male", "female"] as Gender[]).map((g) => (
          <TabsContent key={g} value={g} className="space-y-5 sm:space-y-6 mt-5 sm:mt-6">
            <RankingStrip gender={g} onSelect={setSelectedMemberId} />

            {userHasNoGender && (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="py-3 text-xs sm:text-sm text-muted-foreground">
                  Completa tu género en{" "}
                  <a className="text-primary underline" href="/portal/perfil">tu perfil</a>{" "}
                  para aparecer en Descubrir.
                </CardContent>
              </Card>
            )}

            <Top10Leaderboard gender={g} onSelect={setSelectedMemberId} />
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
