"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { signIn } from "@/lib/actions/auth"
import Link from "next/link"

interface FormData {
  email: string
  password: string
}

export default function LoginMainComponent() {
  const [generalError, setGeneralError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    defaultValues: { email: "", password: "" }
  })

  const onSubmit = async (data: FormData) => {
    setGeneralError("")
    setIsLoading(true)
    const result = await signIn(data.email, data.password)
    
    if (result?.error) {
      setGeneralError("Credenciales inválidas. Verifica tu correo y contraseña.")
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-background p-4">
      <Card className="w-full max-w-md shadow-2xl border-border/50">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-32 h-auto">
            <img src="/Madbox_logo.jpeg" alt="Madbox" className="w-full h-auto object-contain" />
          </div>
          <div>
            <CardTitle className="text-3xl font-bold">Madbox</CardTitle>
            <CardDescription className="text-base mt-2">Panel de administración del gimnasio</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@gimnasio.com"
                {...register("email", { 
                  required: "El correo electrónico es requerido",
                  pattern: { value: /\S+@\S+\.\S+/, message: "Ingresa un correo electrónico válido" }
                })}
                className={errors.email ? "border-destructive" : ""}
              />
              {errors.email && (
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">{errors.email.message}</AlertDescription>
                </Alert>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                {...register("password", { 
                  required: "La contraseña es requerida",
                  minLength: { value: 6, message: "La contraseña debe tener al menos 6 caracteres" }
                })}
                className={errors.password ? "border-destructive" : ""}
              />
              {errors.password && (
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">{errors.password.message}</AlertDescription>
                </Alert>
              )}
            </div>

            <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={isLoading}>
              {isLoading ? "Iniciando sesión..." : "Iniciar sesión"}
            </Button>

            {generalError && (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">{generalError}</AlertDescription>
              </Alert>
            )}

            <p className="text-center text-sm text-muted-foreground mt-4">
              ¿Olvidaste tu contraseña?{" "}
              <Link href="/forgot-password" className="text-primary hover:underline font-medium">Recuperar acceso</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
