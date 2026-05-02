"use server"

import { createClient } from "@/utils/supabase/server"
import { revalidatePath } from "next/cache"
import type { MovementId } from "@/lib/constants/movements"
import { getMovement, calculateTotals, MOVEMENTS } from "@/lib/constants/movements"
import { logActivity } from "./activity"
import { createAdminClient } from "@/utils/supabase/admin"

// ─── Helper: obtener member_id del usuario autenticado ────

async function getMyMemberId(): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")

  const { data: member, error } = await supabase
    .from("members")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  if (error) throw error
  if (!member) throw new Error("Miembro no encontrado")
  return member.id
}

// ─── Mis records ─────────────────────────────────────────

export interface PersonalRecord {
  id: string
  movement: MovementId
  weight_kg: number
  achieved_at: string | null
  updated_at: string | null
}

export async function getMyRecords(): Promise<PersonalRecord[]> {
  const supabase = await createClient()
  const memberId = await getMyMemberId()

  const { data, error } = await supabase
    .from("personal_records")
    .select("id, movement, weight_kg, achieved_at, updated_at")
    .eq("member_id", memberId)
    .order("movement")

  if (error) throw error
  return (data ?? []) as PersonalRecord[]
}

export async function upsertRecord(input: {
  movement: MovementId
  weight_kg: number
  achieved_at?: string | null
}): Promise<PersonalRecord> {
  if (input.weight_kg <= 0 || input.weight_kg > 500) {
    throw new Error("Peso fuera de rango (0 < peso ≤ 500 kg)")
  }

  const supabase = await createClient()
  const memberId = await getMyMemberId()

  const { data, error } = await supabase
    .from("personal_records")
    .upsert(
      {
        member_id: memberId,
        movement: input.movement,
        weight_kg: input.weight_kg,
        achieved_at: input.achieved_at ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "member_id,movement" },
    )
    .select("id, movement, weight_kg, achieved_at, updated_at")
    .single()

  if (error) throw error

  await logActivity({
    action: "pr_updated",
    entityType: "personal_record",
    entityId: data.id,
    entityName: getMovement(input.movement).label,
  })

  revalidatePath("/portal/perfil")
  revalidatePath("/portal/descubrir")
  return data as PersonalRecord
}

export async function deleteRecord(movement: MovementId): Promise<void> {
  const supabase = await createClient()
  const memberId = await getMyMemberId()

  const { data: existing } = await supabase
    .from("personal_records")
    .select("id")
    .eq("member_id", memberId)
    .eq("movement", movement)
    .maybeSingle()

  if (!existing) return

  const { error } = await supabase
    .from("personal_records")
    .delete()
    .eq("id", existing.id)

  if (error) throw error

  await logActivity({
    action: "pr_deleted",
    entityType: "personal_record",
    entityId: existing.id,
    entityName: getMovement(movement).label,
  })

  revalidatePath("/portal/perfil")
  revalidatePath("/portal/descubrir")
}

// ─── Visibilidad ─────────────────────────────────────────

export interface VisibilitySettings {
  discoverable: boolean
  show_plan: boolean
  show_avatar: boolean
  show_rms: boolean
  show_wods: boolean
}

export async function getMyVisibility(): Promise<VisibilitySettings> {
  const supabase = await createClient()
  const memberId = await getMyMemberId()

  const { data, error } = await supabase
    .from("members")
    .select("discoverable, show_plan, show_avatar, show_rms, show_wods")
    .eq("id", memberId)
    .single()

  if (error) throw error
  return {
    discoverable: data.discoverable ?? true,
    show_plan: data.show_plan ?? true,
    show_avatar: data.show_avatar ?? true,
    show_rms: data.show_rms ?? true,
    show_wods: data.show_wods ?? true,
  }
}

export async function updateMyVisibility(
  patch: Partial<VisibilitySettings>,
): Promise<void> {
  const supabase = await createClient()
  const memberId = await getMyMemberId()

  const { error } = await supabase
    .from("members")
    .update(patch)
    .eq("id", memberId)

  if (error) throw error

  revalidatePath("/portal/perfil")
  revalidatePath("/portal/descubrir")
}

// ─── Discover (cross-member) ─────────────────────────────

export interface DiscoverableMember {
  id: string
  name: string
  avatar_url: string | null
  plan_name: string | null
  totals: { grand: number; olympic: number; squat: number; press: number } | null
  top_records: Array<{ movement: MovementId; weight_kg: number }>
}

export interface MemberPublicProfile extends DiscoverableMember {
  start_date: string | null
  records: PersonalRecord[]
}

export interface RankingEntry {
  member_id: string
  name: string
  avatar_url: string | null
  total_kg: number
}

async function ensureAuthenticated(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error("No autenticado")
}

interface MemberRow {
  id: string
  name: string
  avatar_url: string | null
  plan_id: string | null
  start_date: string | null
  discoverable: boolean
  show_plan: boolean
  show_avatar: boolean
  show_rms: boolean
  plans: { name: string } | null
}

interface RecordRow {
  member_id: string
  movement: MovementId
  weight_kg: number
  achieved_at: string | null
  id: string
  updated_at: string | null
}

export async function getDiscoverableMembers(search?: string): Promise<DiscoverableMember[]> {
  await ensureAuthenticated()

  const admin = createAdminClient()

  let query = admin
    .from("members")
    .select("id, name, avatar_url, plan_id, start_date, discoverable, show_plan, show_avatar, show_rms, plans(name)")
    .eq("discoverable", true)
    .order("name", { ascending: true })

  if (search && search.trim().length > 0) {
    query = query.ilike("name", `%${search.trim()}%`)
  }

  const { data: members, error } = await query
  if (error) throw error
  if (!members || members.length === 0) return []

  const memberIds = members.map((m) => m.id)

  const { data: records, error: recError } = await admin
    .from("personal_records")
    .select("member_id, movement, weight_kg")
    .in("member_id", memberIds)

  if (recError) throw recError

  const recordsByMember: Record<string, Record<MovementId, number>> = {}
  for (const r of (records ?? []) as Array<Pick<RecordRow, "member_id" | "movement" | "weight_kg">>) {
    recordsByMember[r.member_id] ??= {} as Record<MovementId, number>
    recordsByMember[r.member_id][r.movement] = Number(r.weight_kg)
  }

  return (members as unknown as MemberRow[]).map((m) => {
    const rms = recordsByMember[m.id] ?? ({} as Record<MovementId, number>)
    const totals = m.show_rms ? calculateTotals(rms) : null

    const topRecords = m.show_rms
      ? MOVEMENTS
          .map((mv) => ({ movement: mv.id, weight_kg: rms[mv.id] ?? 0 }))
          .filter((r) => r.weight_kg > 0)
          .sort((a, b) => b.weight_kg - a.weight_kg)
          .slice(0, 3)
      : []

    return {
      id: m.id,
      name: m.name,
      avatar_url: m.show_avatar ? m.avatar_url : null,
      plan_name: m.show_plan && m.plans ? m.plans.name : null,
      totals,
      top_records: topRecords,
    }
  })
}

export async function getMemberPublicProfile(memberId: string): Promise<MemberPublicProfile> {
  await ensureAuthenticated()

  const admin = createAdminClient()

  const { data: member, error } = await admin
    .from("members")
    .select("id, name, avatar_url, plan_id, start_date, discoverable, show_plan, show_avatar, show_rms, plans(name)")
    .eq("id", memberId)
    .maybeSingle()

  if (error) throw error
  if (!member || !member.discoverable) {
    throw new Error("Miembro no encontrado")
  }

  const m = member as unknown as MemberRow

  const { data: records, error: recError } = await admin
    .from("personal_records")
    .select("id, movement, weight_kg, achieved_at, updated_at")
    .eq("member_id", memberId)
    .order("movement")

  if (recError) throw recError

  const recList: PersonalRecord[] = m.show_rms
    ? ((records ?? []) as PersonalRecord[])
    : []

  const recsMap: Record<string, number> = {}
  for (const r of recList) recsMap[r.movement] = Number(r.weight_kg)

  const totals = m.show_rms ? calculateTotals(recsMap) : null

  const topRecords = m.show_rms
    ? recList
        .filter((r) => Number(r.weight_kg) > 0)
        .sort((a, b) => Number(b.weight_kg) - Number(a.weight_kg))
        .slice(0, 3)
        .map((r) => ({ movement: r.movement, weight_kg: Number(r.weight_kg) }))
    : []

  return {
    id: m.id,
    name: m.name,
    avatar_url: m.show_avatar ? m.avatar_url : null,
    plan_name: m.show_plan && m.plans ? m.plans.name : null,
    start_date: m.start_date,
    totals,
    top_records: topRecords,
    records: recList,
  }
}

export async function getTopByCategory(
  category: "grand" | "olympic" | "squat" | "press",
): Promise<RankingEntry[]> {
  await ensureAuthenticated()

  const admin = createAdminClient()

  const { data: members, error } = await admin
    .from("members")
    .select("id, name, avatar_url, discoverable, show_rms, show_avatar")
    .eq("discoverable", true)
    .eq("show_rms", true)

  if (error) throw error
  if (!members || members.length === 0) return []

  const memberIds = members.map((m) => m.id)

  const { data: records, error: recError } = await admin
    .from("personal_records")
    .select("member_id, movement, weight_kg")
    .in("member_id", memberIds)

  if (recError) throw recError

  const byMember: Record<string, Record<MovementId, number>> = {}
  for (const r of (records ?? []) as Array<Pick<RecordRow, "member_id" | "movement" | "weight_kg">>) {
    byMember[r.member_id] ??= {} as Record<MovementId, number>
    byMember[r.member_id][r.movement] = Number(r.weight_kg)
  }

  const entries: RankingEntry[] = members
    .map((m) => {
      const recs = byMember[m.id] ?? ({} as Record<MovementId, number>)
      const totals = calculateTotals(recs)
      return {
        member_id: m.id,
        name: m.name,
        avatar_url: m.show_avatar ? m.avatar_url : null,
        total_kg: totals[category],
      }
    })
    .filter((e) => e.total_kg > 0)
    .sort((a, b) => b.total_kg - a.total_kg)
    .slice(0, 3)

  return entries
}
