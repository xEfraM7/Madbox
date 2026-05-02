"use client"

import { TodayWodHeader } from "./TodayWodHeader"
import { WodLeaderboard } from "./WodLeaderboard"
import { WodHistoryList } from "./WodHistoryList"

export default function PortalWodMainComponent() {
  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">WOD</h1>
        <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
          Registra tu resultado y mira el leaderboard del día
        </p>
      </div>

      <TodayWodHeader />
      <WodLeaderboard />
      <WodHistoryList />
    </div>
  )
}
