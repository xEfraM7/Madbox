"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query"
import { showToast } from "@/lib/sweetalert"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Upload, X, Star, ImageIcon } from "lucide-react"
import { createProduct, updateProduct, uploadProductImage, getActiveCategories } from "@/lib/actions/products"

interface ProductFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product?: any
}

interface FormData {
  name: string
  description: string
  price: string
  category_id: string
  in_stock: boolean
  featured: boolean
  active: boolean
}

const NO_CATEGORY = "none"

export function ProductFormModal({ open, onOpenChange, product }: ProductFormModalProps) {
  const queryClient = useQueryClient()
  const [images, setImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: { name: "", description: "", price: "", category_id: NO_CATEGORY, in_stock: true, featured: false, active: true }
  })

  const inStock = watch("in_stock")
  const featured = watch("featured")
  const active = watch("active")
  const categoryId = watch("category_id")

  const { data: categories = [] } = useQuery({
    queryKey: ["product-categories"],
    queryFn: getActiveCategories,
  })

  useEffect(() => {
    if (open) {
      if (product) {
        reset({
          name: product.name || "",
          description: product.description || "",
          price: product.price?.toString() || "",
          category_id: product.category_id || NO_CATEGORY,
          in_stock: product.in_stock ?? true,
          featured: product.featured ?? false,
          active: product.active ?? true,
        })
        setImages(product.images || [])
      } else {
        reset({ name: "", description: "", price: "", category_id: NO_CATEGORY, in_stock: true, featured: false, active: true })
        setImages([])
      }
    }
  }, [product, open, reset])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const uploaded: string[] = []
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append("image", file)
        const url = await uploadProductImage(fd)
        uploaded.push(url)
      }
      setImages((prev) => [...prev, ...uploaded])
    } catch (err) {
      showToast.error("Error al subir imagen", err instanceof Error ? err.message : "Inténtalo de nuevo")
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  const removeImage = (url: string) => setImages((prev) => prev.filter((u) => u !== url))
  const makePrimary = (url: string) => setImages((prev) => [url, ...prev.filter((u) => u !== url)])

  const createMutation = useMutation({
    mutationFn: (data: any) => createProduct(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
      showToast.success("Producto creado", "El producto ha sido creado correctamente.")
      onOpenChange(false)
    },
    onError: () => showToast.error("Error", "No se pudo crear el producto."),
  })

  const updateMutation = useMutation({
    mutationFn: (data: any) => updateProduct(product.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] })
      showToast.success("Producto actualizado", "Los cambios han sido guardados.")
      onOpenChange(false)
    },
    onError: () => showToast.error("Error", "No se pudo actualizar el producto."),
  })

  const onSubmit = (data: FormData) => {
    const payload = {
      name: data.name,
      description: data.description || null,
      price: parseFloat(data.price),
      category_id: data.category_id === NO_CATEGORY ? null : data.category_id,
      images,
      in_stock: data.in_stock,
      featured: data.featured,
      active: data.active,
    }
    if (product) updateMutation.mutate(payload)
    else createMutation.mutate(payload)
  }

  const isLoading = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? "Editar producto" : "Nuevo producto"}</DialogTitle>
          <DialogDescription>{product ? "Modifica los detalles del producto" : "Agrega un producto al catálogo"}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-5 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" {...register("name", { required: "El nombre es requerido" })} placeholder="Ej: Proteína Whey 2lb" />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="grid gap-4 grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="price">Precio (USD)</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-green-500">$</span>
                  <Input id="price" type="number" step="0.01" className="pl-7" {...register("price", { required: "El precio es requerido", min: { value: 0, message: "Debe ser positivo" } })} placeholder="32.00" />
                </div>
                {errors.price && <p className="text-sm text-destructive">{errors.price.message}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="category">Categoría</Label>
                <Select value={categoryId} onValueChange={(v) => setValue("category_id", v)}>
                  <SelectTrigger id="category"><SelectValue placeholder="Sin categoría" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CATEGORY}>Sin categoría</SelectItem>
                    {categories.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea id="description" {...register("description")} placeholder="Detalles del producto…" rows={3} className="resize-none" />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Imágenes</Label>
                <span className="text-xs text-muted-foreground">{images.length > 0 ? `${images.length} imagen${images.length === 1 ? "" : "es"}` : "JPG, PNG o WebP"}</span>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {images.map((url, i) => (
                  <div key={url} className={cn("group relative h-24 w-24 overflow-hidden rounded-lg border bg-muted transition-colors", i === 0 ? "border-primary/60 ring-1 ring-primary/30" : "border-border")}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Imagen ${i + 1}`} className="h-full w-full object-cover" />
                    {i === 0 && (
                      <span className="absolute left-0 top-0 flex items-center gap-0.5 rounded-br-md bg-primary px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary-foreground">
                        <Star className="h-2.5 w-2.5 fill-current" />Principal
                      </span>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/55 opacity-0 backdrop-blur-[1px] transition-opacity group-hover:opacity-100">
                      {i !== 0 && (
                        <button type="button" onClick={() => makePrimary(url)} title="Hacer principal" className="rounded-md bg-white/10 p-1.5 text-white transition-colors hover:bg-primary hover:text-primary-foreground cursor-pointer">
                          <Star className="h-4 w-4" />
                        </button>
                      )}
                      <button type="button" onClick={() => removeImage(url)} title="Eliminar" className="rounded-md bg-white/10 p-1.5 text-white transition-colors hover:bg-destructive hover:text-destructive-foreground cursor-pointer">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                <label className={cn("flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-muted-foreground transition-colors", uploading ? "cursor-wait bg-muted/40" : "cursor-pointer hover:border-primary/50 hover:bg-muted/50 hover:text-foreground")}>
                  {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                  <span className="text-[11px] font-medium">{uploading ? "Subiendo…" : "Subir"}</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={handleFileChange} disabled={uploading} />
                </label>
              </div>
              {images.length === 0 && !uploading && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ImageIcon className="h-3.5 w-3.5" />
                  La primera imagen será la principal en el catálogo.
                </p>
              )}
            </div>

            <div className="grid gap-1 rounded-lg border border-border bg-muted/30 p-1">
              <div className="flex items-center justify-between rounded-md px-3 py-2.5">
                <div>
                  <Label htmlFor="in_stock" className="cursor-pointer">Disponible</Label>
                  <p className="text-xs text-muted-foreground">En stock para la venta</p>
                </div>
                <Switch id="in_stock" checked={inStock} onCheckedChange={(c) => setValue("in_stock", c)} />
              </div>
              <div className="flex items-center justify-between rounded-md px-3 py-2.5">
                <div>
                  <Label htmlFor="featured" className="cursor-pointer">Destacado</Label>
                  <p className="text-xs text-muted-foreground">Resaltado en el catálogo</p>
                </div>
                <Switch id="featured" checked={featured} onCheckedChange={(c) => setValue("featured", c)} />
              </div>
              <div className="flex items-center justify-between rounded-md px-3 py-2.5">
                <div>
                  <Label htmlFor="active" className="cursor-pointer">Visible en el portal</Label>
                  <p className="text-xs text-muted-foreground">Lo ven los clientes</p>
                </div>
                <Switch id="active" checked={active} onCheckedChange={(c) => setValue("active", c)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancelar</Button>
            <Button type="submit" disabled={isLoading || uploading}>
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : product ? "Guardar cambios" : "Crear producto"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
