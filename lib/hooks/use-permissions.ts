"use client"

import { useQuery } from "@tanstack/react-query"
import { getCurrentAdminPermissions } from "@/lib/actions/roles"

export function usePermissions() {
  const { data, isLoading } = useQuery({
    queryKey: ["current-admin-permissions"],
    queryFn: getCurrentAdminPermissions,
    staleTime: 5 * 60 * 1000, // 5 minutos
  })

  const permissions = data?.permissions || []
  const isAdmin = data?.isAdmin || false

  const hasPermission = (permission: string) => {
    if (isAdmin) return true // Super admin tiene todos los permisos
    return permissions.includes(permission)
  }

  const hasAnyPermission = (permissionList: string[]) => {
    if (isAdmin) return true
    return permissionList.some(p => permissions.includes(p))
  }

  const hasAllPermissions = (permissionList: string[]) => {
    if (isAdmin) return true
    return permissionList.every(p => permissions.includes(p))
  }

  return {
    permissions,
    isAdmin,
    isLoading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
  }
}
