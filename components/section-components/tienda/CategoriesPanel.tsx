"use client"

import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { showToast } from "@/lib/sweetalert"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Plus, Edit, Trash2, Tag } from "lucide-react"
import { deleteCategory } from "@/lib/actions/products"

interface CategoriesPanelProps {
  categories: any[]
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  onCreate: () => void
  onEdit: (category: any) => void
}

export function CategoriesPanel({ categories, canCreate, canEdit, canDelete, onCreate, onEdit }: CategoriesPanelProps) {
  const queryClient = useQueryClient()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [toDelete, setToDelete] = useState<any>(null)

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-categories"] })
      queryClient.invalidateQueries({ queryKey: ["products"] })
      showToast.success("Categoría eliminada", `${toDelete?.name} ha sido eliminada.`)
      setDeleteOpen(false)
      setToDelete(null)
    },
    onError: () => showToast.error("Error", "No se pudo eliminar la categoría."),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {categories.length > 0
            ? `${categories.length} categoría${categories.length === 1 ? "" : "s"} en el catálogo`
            : "Organiza tus productos en categorías"}
        </p>
        {canCreate && <Button onClick={onCreate}><Plus className="mr-2 h-4 w-4" />Nueva categoría</Button>}
      </div>
      {categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Tag className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-medium">Aún no hay categorías</p>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">Crea categorías para agrupar y filtrar tus productos en el portal.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Nombre</TableHead>
                <TableHead className="w-24">Orden</TableHead>
                <TableHead className="w-28">Estado</TableHead>
                <TableHead className="w-24 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((cat) => (
                <TableRow key={cat.id}>
                  <TableCell className="font-medium">{cat.name}</TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">{cat.sort_order}</TableCell>
                  <TableCell>{cat.active ? <Badge variant="secondary">Activa</Badge> : <Badge variant="outline" className="text-muted-foreground">Inactiva</Badge>}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {canEdit && <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(cat)}><Edit className="h-4 w-4" /></Button>}
                      {canDelete && <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => { setToDelete(cat); setDeleteOpen(true) }}><Trash2 className="h-4 w-4" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="¿Eliminar categoría?"
        description={`Se eliminará "${toDelete?.name}". Los productos en esta categoría quedarán sin categoría.`}
        confirmText="Eliminar"
        variant="danger"
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)}
        isLoading={deleteMutation.isPending}
      />
    </div>
  )
}
