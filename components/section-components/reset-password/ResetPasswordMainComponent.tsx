"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dumbbell, AlertCircle, CheckCircle, Eye, EyeOff } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"
import { updatePassword } from "@/lib/actions/auth"

interface FormData {
  password: string
  confirmPassword: string
}

export default function ResetPasswordMainComponent() {
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [generalError, setGeneralError] = useState("")

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    defaultValues: { password: "", confirmPassword: "" }
  })

  const password = watch("password")

  const onSubmit = async (data: FormData) => {
    setGeneralError("")
    setIsLoading(true)
    const result = await updatePassword(data.password)
    setIsLoading(false)

    if (result.error) {
      setGeneralError("No se pudo actualizar la contraseña. El enlace puede haber expirado.")
    } else {
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-background p-4">
        <Card className="w-full max-w-md shadow-2xl border-border/50">
          <CardHeader className="space-y-4 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">Contraseña actualizada</CardTitle>
              <CardDescription className="text-base mt-2">
                Tu contraseña ha sido restablecida correctamente
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Link href="/login" className="block">
              <Button className="w-full h-11 text-base font-semibold">
                Iniciar sesión
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-background p-4">
      <Card className="w-full max-w-md shadow-2xl border-border/50">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Dumbbell className="w-8 h-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Nueva contraseña</CardTitle>
            <CardDescription className="text-base mt-2">
              Ingresa tu nueva contraseña para restablecer el acceso
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium">Nueva contraseña</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  {...register("password", {
                    required: "La contraseña es requerida",
                    minLength: { value: 6, message: "La contraseña debe tener al menos 6 caracteres" }
                  })}
                  className={errors.password ? "border-destructive pr-10" : "pr-10"}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                </Button>
              </div>
              {errors.password && (
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">{errors.password.message}</AlertDescription>
                </Alert>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirmar contraseña</Label>
              <Input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                {...register("confirmPassword", {
                  required: "Confirma tu contraseña",
                  validate: (value) => value === password || "Las contraseñas no coinciden"
                })}
                className={errors.confirmPassword ? "border-destructive" : ""}
              />
              {errors.confirmPassword && (
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">{errors.confirmPassword.message}</AlertDescription>
                </Alert>
              )}
            </div>

            {generalError && (
              <Alert variant="destructive" className="py-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-sm">{generalError}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={isLoading}>
              {isLoading ? "Actualizando..." : "Restablecer contraseña"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
