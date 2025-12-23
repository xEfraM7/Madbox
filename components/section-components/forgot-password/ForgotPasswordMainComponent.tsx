"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dumbbell, AlertCircle, ArrowLeft, Mail, CheckCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import Link from "next/link"
import { resetPassword } from "@/lib/actions/auth"

interface FormData {
  email: string
}

export default function ForgotPasswordMainComponent() {
  const [isLoading, setIsLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [sentEmail, setSentEmail] = useState("")
  const [generalError, setGeneralError] = useState("")

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>({
    defaultValues: { email: "" }
  })

  const onSubmit = async (data: FormData) => {
    setGeneralError("")
    setIsLoading(true)
    const result = await resetPassword(data.email)
    setIsLoading(false)

    if (result.error) {
      setGeneralError("No se pudo enviar el correo. Intenta de nuevo.")
    } else {
      setSentEmail(data.email)
      setEmailSent(true)
    }
  }

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-background p-4">
        <Card className="w-full max-w-md shadow-2xl border-border/50">
          <CardHeader className="space-y-4 text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">Correo enviado</CardTitle>
              <CardDescription className="text-base mt-2">
                Hemos enviado un enlace de recuperación a <span className="font-medium text-foreground">{sentEmail}</span>
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Revisa tu bandeja de entrada y sigue las instrucciones para restablecer tu contraseña. 
              El enlace expira en 24 horas.
            </p>
            <div className="flex flex-col gap-2">
              <Button variant="outline" className="w-full" onClick={() => { setEmailSent(false); reset() }}>
                <Mail className="mr-2 h-4 w-4" />
                Enviar a otro correo
              </Button>
              <Link href="/login" className="w-full">
                <Button variant="ghost" className="w-full">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Volver al inicio de sesión
                </Button>
              </Link>
            </div>
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
            <CardTitle className="text-2xl font-bold">Recuperar acceso</CardTitle>
            <CardDescription className="text-base mt-2">
              Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña
            </CardDescription>
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
              {generalError && (
                <Alert variant="destructive" className="py-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">{generalError}</AlertDescription>
                </Alert>
              )}
            </div>

            <Button type="submit" className="w-full h-11 text-base font-semibold" disabled={isLoading}>
              {isLoading ? "Enviando..." : "Enviar enlace de recuperación"}
            </Button>

            <Link href="/login" className="block">
              <Button type="button" variant="ghost" className="w-full">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver al inicio de sesión
              </Button>
            </Link>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
