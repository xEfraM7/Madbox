"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { showToast } from "@/lib/sweetalert"
import { cn } from "@/lib/utils"
import { DashboardLayout } from "@/components/shared/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Plus, MoreVertical, Edit, Trash2, Loader2, Star, PackageX, ShoppingBag, Search } from "lucide-react"
import { usePermissions } from "@/lib/hooks/use-permissions"
import { getExchangeRates } from "@/lib/actions/funds"
import { getProducts, deleteProduct, getCategories } from "@/lib/actions/products"
import { ProductFormModal } from "./modals/product-form-modal"
import { CategoryFormModal } from "./modals/category-form-modal"
import { CategoriesPanel } from "./CategoriesPanel"

const ALL = "all"

export function TiendaMainComponent() {
  const queryClient = useQueryClient()
  const { hasPermission, isAdmin } = usePermissions()
  const canCreate = isAdmin || hasPermission("products.create")
  const canEdit = isAdmin || hasPermission("products.edit")
  const canDelete = isAdmin || hasPermission("products.delete")

  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState(ALL)
  const [productModalOpen, setProductModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<any>(null)
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<any>(null)

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: () => getProducts(),
  })

  const { data: categories = [] } = useQuery({
    queryKey: ["product-categories"],
    queryFn: getCategories,
  })

  const { data: exchangeRates = [] } = useQuery({
    queryKey: ["exchange-rates"],
    queryFn: getExchangeRates,
  })
  const bcvRate = exchangeRates.find((r: any) => r.type === "BCV")?.rate || 0

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
      showToast.success("Producto eliminado", `${productToDelete?.name} ha sido eliminado.`)
      setDeleteOpen(false)
      setProductToDelete(null)
    },
    onError: () => showToast.error("Error", "No se pudo eliminar el producto."),
  })

  const filtered = products.filter((p: any) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilter === ALL || p.category_id === categoryFilter
    return matchesSearch && matchesCategory
  })

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-balance">Tienda</h1>
            <p className="text-muted-foreground mt-1">Gestiona los productos del catálogo</p>
          </div>
        </div>

        <Tabs defaultValue="products" className="space-y-6">
          <TabsList>
            <TabsTrigger value="products">Productos</TabsTrigger>
            <TabsTrigger value="categories">Categorías</TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 gap-2">
                <div className="relative w-full max-w-xs">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar producto…" className="pl-9" />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>Todas las categorías</SelectItem>
                    {categories.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {canCreate && (
                <Button onClick={() => { setSelectedProduct(null); setProductModalOpen(true) }}>
                  <Plus className="mr-2 h-4 w-4" />Nuevo producto
                </Button>
              )}
            </div>

            {isLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <ShoppingBag className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="font-medium">
                  {search || categoryFilter !== ALL ? "No hay productos que coincidan" : "Aún no hay productos"}
                </p>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">
                  {search || categoryFilter !== ALL
                    ? "Prueba ajustando la búsqueda o el filtro de categoría."
                    : "Agrega tu primer producto para empezar a construir el catálogo."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((product: any) => (
                  <Card
                    key={product.id}
                    className={cn(
                      "group gap-0 overflow-hidden p-0 transition-colors hover:border-primary/40",
                      !product.active && "opacity-70"
                    )}
                  >
                    <div className="relative aspect-video overflow-hidden bg-muted">
                      {product.images?.[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.images[0]}
                          alt={product.name}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground"><ShoppingBag className="h-8 w-8 opacity-40" /></div>
                      )}
                      <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                        {product.featured && <Badge className="gap-1 bg-primary text-primary-foreground shadow-sm"><Star className="h-3 w-3 fill-current" />Destacado</Badge>}
                        {!product.in_stock && <Badge variant="secondary" className="gap-1 shadow-sm"><PackageX className="h-3 w-3" />Agotado</Badge>}
                        {!product.active && <Badge variant="outline" className="bg-background/80 shadow-sm backdrop-blur-sm">Inactivo</Badge>}
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="truncate font-semibold leading-tight">{product.name}</h3>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">{product.product_categories?.name || "Sin categoría"}</p>
                        </div>
                        {(canEdit || canDelete) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {canEdit && <DropdownMenuItem onClick={() => { setSelectedProduct(product); setProductModalOpen(true) }}><Edit className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>}
                              {canDelete && <DropdownMenuItem onClick={() => { setProductToDelete(product); setDeleteOpen(true) }} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" />Eliminar</DropdownMenuItem>}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                      <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-lg font-bold text-green-500 tabular-nums">${Number(product.price).toFixed(2)}</span>
                        {bcvRate > 0 && <span className="text-xs text-blue-400 tabular-nums">≈ Bs {(Number(product.price) * bcvRate).toLocaleString("es-VE", { maximumFractionDigits: 0 })}</span>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="categories">
            <CategoriesPanel
              categories={categories}
              canCreate={canCreate}
              canEdit={canEdit}
              canDelete={canDelete}
              onCreate={() => { setSelectedCategory(null); setCategoryModalOpen(true) }}
              onEdit={(cat) => { setSelectedCategory(cat); setCategoryModalOpen(true) }}
            />
          </TabsContent>
        </Tabs>
      </div>

      <ProductFormModal open={productModalOpen} onOpenChange={setProductModalOpen} product={selectedProduct} />
      <CategoryFormModal open={categoryModalOpen} onOpenChange={setCategoryModalOpen} category={selectedCategory} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="¿Eliminar producto?"
        description={`Se eliminará "${productToDelete?.name}". Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        variant="danger"
        onConfirm={() => productToDelete && deleteMutation.mutate(productToDelete.id)}
        isLoading={deleteMutation.isPending}
      />
    </DashboardLayout>
  )
}
