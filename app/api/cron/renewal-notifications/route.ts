import { NextResponse } from "next/server"
import { sendRenewalNotifications } from "@/lib/actions/renewal-notifications"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const expected = process.env.CRON_SECRET

  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await sendRenewalNotifications()
  return NextResponse.json(result)
}
