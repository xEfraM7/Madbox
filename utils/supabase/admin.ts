import { createClient } from "@supabase/supabase-js"

// Cliente con service_role para operaciones administrativas
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL en el entorno")
  }
  if (!supabaseServiceKey) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en el entorno (revisa nombre exacto, entorno y redeploy)")
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
