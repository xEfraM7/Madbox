import { createServerClient } from "@supabase/ssr"
import { type NextRequest, NextResponse } from "next/server"
import type { User, SupabaseClient } from "@supabase/supabase-js"

async function getUserRole(
  user: User,
  supabase: SupabaseClient
): Promise<"admin" | "member" | null> {
  const role = user.app_metadata?.role as string | undefined
  if (role === "admin") return "admin"
  if (role === "member") return "member"

  // Fallback para admins existentes sin app_metadata.role
  const { data: admin } = await supabase
    .from("admins")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle()

  if (admin) return "admin"
  return null
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // Usuario no autenticado intenta acceder a rutas protegidas
  if (!user) {
    if (pathname.startsWith("/dashboard") || pathname.startsWith("/portal")) {
      return NextResponse.redirect(new URL("/login", request.url))
    }
    return supabaseResponse
  }

  // Usuario autenticado en rutas de auth → redirigir a su área
  if (pathname === "/login" || pathname === "/forgot-password") {
    const role = await getUserRole(user, supabase)
    const dest = role === "member" ? "/portal" : "/dashboard"
    return NextResponse.redirect(new URL(dest, request.url))
  }

  // Protección de rutas por rol
  if (pathname.startsWith("/dashboard")) {
    const role = await getUserRole(user, supabase)
    if (role === "member") {
      return NextResponse.redirect(new URL("/portal", request.url))
    }
  }

  if (pathname.startsWith("/portal")) {
    const role = await getUserRole(user, supabase)
    if (role !== "member") {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
    // Gate de cambio de contraseña obligatorio
    if (
      pathname !== "/portal/cambiar-contrasena" &&
      user.user_metadata?.must_change_password === true
    ) {
      return NextResponse.redirect(new URL("/portal/cambiar-contrasena", request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
