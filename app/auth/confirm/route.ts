import { type EmailOtpType } from "@supabase/supabase-js"
import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/utils/supabase/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const next = searchParams.get("next") ?? "/"
  
  // También manejar el código de autorización (PKCE flow)
  const code = searchParams.get("code")

  const redirectTo = request.nextUrl.clone()
  redirectTo.pathname = next
  redirectTo.searchParams.delete("token_hash")
  redirectTo.searchParams.delete("type")
  redirectTo.searchParams.delete("next")
  redirectTo.searchParams.delete("code")

  const supabase = await createClient()

  // Manejar código de autorización (usado en recovery con PKCE)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      if (next === "/reset-password") {
        redirectTo.pathname = "/reset-password"
      }
      return NextResponse.redirect(redirectTo)
    }
  }

  // Manejar token_hash (flujo tradicional)
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })

    if (!error) {
      if (type === "recovery") {
        redirectTo.pathname = "/reset-password"
      }
      return NextResponse.redirect(redirectTo)
    }
  }

  // Redirigir a página de error
  redirectTo.pathname = "/login"
  redirectTo.searchParams.set("error", "invalid_token")
  return NextResponse.redirect(redirectTo)
}
