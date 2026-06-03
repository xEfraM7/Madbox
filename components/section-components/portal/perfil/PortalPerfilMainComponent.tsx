"use client"

import { useQuery } from "@tanstack/react-query"
import { Loader2 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getMyProfile } from "@/lib/actions/portal"
import { DatosTab } from "./DatosTab"
import { MarcasTab } from "./MarcasTab"
import { PrivacidadTab } from "./PrivacidadTab"
import PortalPagosMainComponent from "../pagos/PortalPagosMainComponent"

export default function PortalPerfilMainComponent() {
  const { isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: getMyProfile,
    staleTime: 5 * 60 * 1000,
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Mi Perfil</h1>
        <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
          Tus datos, marcas y configuración de privacidad
        </p>
      </div>

      <Tabs defaultValue="datos" className="space-y-5 sm:space-y-6">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="datos" className="flex-1 sm:flex-none">Datos</TabsTrigger>
          <TabsTrigger value="marcas" className="flex-1 sm:flex-none">Marcas</TabsTrigger>
          <TabsTrigger value="pagos" className="flex-1 sm:flex-none">Pagos</TabsTrigger>
          <TabsTrigger value="privacidad" className="flex-1 sm:flex-none">Privacidad</TabsTrigger>
        </TabsList>
        <TabsContent value="datos"><DatosTab /></TabsContent>
        <TabsContent value="marcas"><MarcasTab /></TabsContent>
        <TabsContent value="pagos"><PortalPagosMainComponent /></TabsContent>
        <TabsContent value="privacidad"><PrivacidadTab /></TabsContent>
      </Tabs>
    </div>
  )
}
