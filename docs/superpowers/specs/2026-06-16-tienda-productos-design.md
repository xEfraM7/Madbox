# Diseño — Tienda de productos (Market)

> Fecha: 2026-06-16
> Estado: Aprobado (pendiente de revisión final del usuario antes del plan)
> Idioma del feature: español (UI, logs, commits)

## 1. Propósito

Ofrecer un **catálogo de productos** del gimnasio (suplementos, ropa, accesorios, etc.).
El administrador los gestiona desde una nueva sección **Tienda** del dashboard; los
clientes los exploran desde un nuevo tab **Tienda** del portal y contactan por
**WhatsApp** para comprar.

No hay carrito ni pago en línea: es un catálogo + contacto. La compra se concreta
fuera de la app (WhatsApp / en persona).

### Criterios de éxito

1. Un admin con permiso puede crear/editar/eliminar productos y categorías, subir
   varias imágenes y marcar destacado / agotado / inactivo.
2. Un cliente ve solo productos activos, filtrables por categoría, con precio en USD y
   su equivalente estimado en Bs (tasa BCV).
3. El botón "Pedir por WhatsApp" abre un chat con un mensaje prellenado que identifica
   el producto.
4. Todo el acceso a datos pasa por Server Actions; las mutaciones revalidan rutas,
   registran actividad y respetan permisos server-side y RLS.

## 2. Decisiones tomadas (brainstorming)

| Decisión | Elección |
|---|---|
| Alcance | Catálogo + contacto por WhatsApp (sin carrito/checkout) |
| Precio | Base en **USD**, se muestra equivalente en **Bs** con tasa **BCV** |
| Ubicación en portal | **Nuevo tab "Tienda"** en la navegación (6º item) |
| Categorías | **Tabla gestionable** (`product_categories`) con CRUD en admin |
| Stock | **Toggle disponible/agotado** (`in_stock` boolean), sin decremento |
| Destacados | Sí (`featured` boolean) |
| Imágenes | **Varias por producto** (`images text[]`, la 1ª es la principal) |
| WhatsApp | **Nuevo campo `whatsapp`** en `gym_settings`, número único global |

## 3. Modelo de datos

Nueva migración SQL en `supabase/migrations/<timestamp>_tienda_productos.sql`.
Tras aplicarla se regenera `types/database.ts` desde Supabase.

### Tabla `product_categories`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK default `gen_random_uuid()` | |
| `name` | text not null | Ej: "Suplementos" |
| `sort_order` | int not null default 0 | Orden de aparición |
| `active` | boolean not null default true | Ocultar sin borrar |
| `created_at` | timestamptz default `now()` | |
| `updated_at` | timestamptz default `now()` | |

### Tabla `products`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK default `gen_random_uuid()` | |
| `name` | text not null | |
| `description` | text null | Descripción larga (opcional) |
| `price` | numeric not null | **Base en USD** (`>= 0`, check) |
| `category_id` | uuid null | FK → `product_categories(id)` `ON DELETE SET NULL` |
| `images` | text[] not null default `'{}'` | URLs Cloudinary; `images[0]` = principal |
| `in_stock` | boolean not null default true | Toggle disponible/agotado |
| `featured` | boolean not null default false | Destacado |
| `active` | boolean not null default true | Visible en el portal |
| `sort_order` | int not null default 0 | |
| `created_at` | timestamptz default `now()` | |
| `updated_at` | timestamptz default `now()` | |

Índices: `products(category_id)`, `products(active)`.

### Cambio en `gym_settings`

Nueva columna `whatsapp text null` — número en formato internacional (`+58412XXXXXXX`).
Se edita desde **Configuración**.

### RLS (mismo patrón que `routine_schedules`)

```sql
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products            ENABLE ROW LEVEL SECURITY;

-- Lectura: cualquier usuario autenticado (el filtrado active/in_stock lo hace la action)
CREATE POLICY "auth read product_categories" ON product_categories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read products" ON products
  FOR SELECT TO authenticated USING (true);

-- Escritura: solo admins (helper is_admin() ya existente)
CREATE POLICY "admins write product_categories" ON product_categories
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "admins write products" ON products
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());
```

> Nota: el portal lee con la sesión del miembro (`createClient()` SSR). La política
> `USING (true)` para `SELECT` replica el patrón actual de `plans`/`routine_schedules`;
> la restricción a productos `active` y la presentación se resuelven en la server action.

## 4. Capa de datos — `lib/actions/products.ts` (`"use server"`)

Sigue exactamente el patrón de `lib/actions/plans.ts`: `createClient()` server, `throw error`,
`revalidatePath`, `logActivity`, y guarda de permisos con `getCurrentAdminPermissions()`
antes de cada mutación.

### Productos

- `getProducts(filters?: { categoryId?: string; search?: string })` — admin; todos los
  productos con `product_categories(name)`. Orden: `sort_order`, luego `created_at`.
- `getStoreProducts()` — portal; solo `active = true`. Orden: `featured desc`,
  `sort_order asc`, `created_at desc`. Incluye categoría.
- `createProduct(input)` / `updateProduct(id, input)` / `deleteProduct(id)`.

### Categorías

- `getCategories()` — admin (todas) / `getActiveCategories()` — para selects y filtros.
- `createCategory(input)` / `updateCategory(id, input)` / `deleteCategory(id)`.

### Imágenes

- `uploadProductImage(formData: FormData): Promise<string>` — reusa el patrón Cloudinary
  de `portal.ts` (`uploadAvatarToCloudinary`): valida tipo (jpg/png/webp) y tamaño (≤ 30MB),
  sube a folder `madbox/products`, devuelve `secure_url`. Sin `public_id` fijo (varias
  imágenes), con transformación a tamaño de catálogo (p. ej. `width:800, crop:limit`).
- El form mantiene el array `images`; el orden define la principal.
- (Opcional, fase posterior) borrado de imágenes en Cloudinary al eliminar producto.

### Revalidación y logging

- Mutaciones de productos/categorías: `revalidatePath("/dashboard/tienda")` y
  `revalidatePath("/portal/tienda")`.
- `logActivity(...)` con nuevas acciones/entidades (ver §6).

## 5. Permisos

Nuevo grupo en `permissionGroups` (`components/section-components/roles/RolesMainComponent.tsx`):

```ts
{
  id: "products",
  label: "Tienda",
  permissions: [
    { id: "products.view",   label: "Ver tienda",        description: "Ver productos y categorías" },
    { id: "products.create", label: "Crear productos",   description: "Crear productos y categorías" },
    { id: "products.edit",   label: "Editar productos",  description: "Modificar productos y categorías" },
    { id: "products.delete", label: "Eliminar productos",description: "Eliminar productos y categorías" },
  ]
}
```

- Las **categorías** se gestionan con `products.create/edit/delete` (sin permiso aparte,
  para no inflar el catálogo).
- Guarda server-side en cada mutación de `products.ts` con `getCurrentAdminPermissions()`.
- Guarda client-side con `usePermissions()` (`hasPermission('products.edit')`, etc.).
- Se añade el grupo `products.*` a la lista de permisos de `CLAUDE.md`.

## 6. Logging — `lib/actions/activity.ts`

Ampliar los tipos:

- `ActivityAction`: `product_created | product_updated | product_deleted |
  product_category_created | product_category_updated | product_category_deleted`.
- `EntityType`: `product | product_category`.

## 7. Admin — `/dashboard/tienda`

### Navegación

Nueva entrada en `navigation` de `components/shared/dashboard-layout.tsx`:
`{ name: "Tienda", href: "/dashboard/tienda", icon: ShoppingBag, permissions: ["products.view"] }`
(ubicada después de "Clases Especiales").

### Página y componentes

- `app/dashboard/tienda/page.tsx` — renderiza `<TiendaMainComponent />` (página fina).
- `components/section-components/tienda/TiendaMainComponent.tsx` — client component con
  **sub-pestañas** shadcn `Tabs`:
  - **Productos**: barra de acciones (búsqueda + filtro por categoría + botón "Nuevo
    producto" gateado por `products.create`). Grid de tarjetas: imagen principal, nombre,
    categoría, precio USD + "≈ Bs" (tasa BCV de `getExchangeRates`), badges
    Destacado / Agotado / Inactivo, acciones editar/eliminar gateadas.
  - **Categorías**: lista/tabla con nombre, orden, activo y acciones; botón "Nueva
    categoría". Al eliminar una categoría con productos, estos quedan `category_id = null`
    (FK SET NULL); se advierte en el diálogo.
  - `index.ts` re-exporta el main.
- `components/section-components/tienda/modals/product-form-modal.tsx` — RHF + `zodResolver`:
  nombre, descripción (`Textarea`), precio USD (`number`), categoría (`Select` con
  `getActiveCategories`), toggles `in_stock` / `featured` / `active` (`Switch`), y
  **uploader multi-imagen** con preview, reordenar (drag o flechas) y eliminar. Subida vía
  `uploadProductImage`. Crear/editar con TanStack Query `useMutation` + `invalidateQueries`.
- `components/section-components/tienda/modals/category-form-modal.tsx` — nombre,
  `sort_order`, `active`.
- Confirmaciones destructivas con **SweetAlert2** (tema oscuro), toasts con **sonner**.

### TanStack Query (admin)

`queryKey`: `['products', filters]`, `['product-categories']`. Tras mutar:
`invalidateQueries` de ambas claves según corresponda.

## 8. Portal — `/portal/tienda`

### Navegación

Nueva entrada en `nav` de `app/portal/layout.tsx`:
`{ name: "Tienda", href: "/portal/tienda", icon: ShoppingBag, match: (p) => p.startsWith("/portal/tienda") }`.
Queda en 6 items: header desktop muestra todos; el bottom nav móvil pasa a 6 columnas
(se valida que el layout de `flex-1` siga legible; si seis quedan apretados, se reduce el
label a icono+texto pequeño ya existente — sin cambios estructurales).

### Página y componentes

- `app/portal/tienda/page.tsx` — renderiza `<PortalTiendaMainComponent />`.
- `components/section-components/portal/tienda/PortalTiendaMainComponent.tsx` — client
  component. `useQuery(['store-products'], getStoreProducts)` + `useQuery(['store-categories'],
  getActiveCategories)` + tasa BCV (`getExchangeRates`). Chips de categoría con scroll
  horizontal en móvil ("Todos" + categorías). Grid responsive de `ProductCard`. Estados:
  loading (skeletons), vacío ("Aún no hay productos disponibles").
- `components/section-components/portal/tienda/ProductCard.tsx` — `next/image` (imagen
  principal), nombre, categoría, **precio USD grande (verde) + "≈ Bs X" (azul)**, badge
  "Agotado" atenuado si `!in_stock`, badge "Destacado" si aplica. CTA **"Pedir por
  WhatsApp"**:
  `https://wa.me/<whatsapp sin +>?text=<encodeURIComponent("Hola, me interesa: <nombre> ($<precio>)")>`.
  Si `!in_stock`, CTA deshabilitado con texto "Agotado". Si `gym_settings.whatsapp` es
  nulo, se oculta el CTA (o se deshabilita con tooltip).
- Detalle de producto: `Sheet` (móvil) / `Dialog` (desktop) dentro del mismo main, con
  galería (varias imágenes), descripción larga y el mismo CTA. (Si resulta innecesario en
  la fase de UI, puede degradarse a solo-card; se decide durante frontend-design.)

### Conversión Bs

`bsEstimado = price * bcvRate`, redondeo a entero o 2 decimales según convención. La tasa
BCV se obtiene de `getExchangeRates()` (ya usada en el dashboard). Se muestra como
estimado ("≈ Bs ...").

## 9. Sistema de diseño

- Modo oscuro fijo, primario amarillo/dorado. Tarjetas con bordes suaves, `next/image`,
  skeletons de carga y micro-interacciones con `tw-animate-css`.
- Paleta semántica: precio USD en **verde**, Bs en **azul**, "Destacado" en **amarillo**,
  "Agotado" atenuado/neutro.
- Iconos solo `lucide-react` (`ShoppingBag`, `MessageCircle` para WhatsApp, `Star` para
  destacado, etc.).
- El pulido visual del storefront y las tarjetas se realiza aplicando **frontend-design**
  y **ui-ux-pro-max**.

## 10. Archivos afectados (resumen)

**Nuevos**
- `supabase/migrations/<ts>_tienda_productos.sql`
- `lib/actions/products.ts`
- `app/dashboard/tienda/page.tsx`
- `components/section-components/tienda/{TiendaMainComponent.tsx,index.ts}`
- `components/section-components/tienda/modals/{product-form-modal.tsx,category-form-modal.tsx}`
- `app/portal/tienda/page.tsx`
- `components/section-components/portal/tienda/{PortalTiendaMainComponent.tsx,ProductCard.tsx}`

**Modificados**
- `types/database.ts` (regenerado)
- `lib/actions/activity.ts` (tipos)
- `lib/actions/settings.ts` (no requiere cambios de firma; `whatsapp` entra por `TablesUpdate`)
- `components/section-components/settings/SettingsMainComponent.tsx` (campo WhatsApp)
- `components/section-components/roles/RolesMainComponent.tsx` (`permissionGroups`)
- `components/shared/dashboard-layout.tsx` (nav admin)
- `app/portal/layout.tsx` (nav portal)
- `CLAUDE.md` (lista de permisos)

## 11. Fuera de alcance (YAGNI)

Carrito, checkout / pago en línea, inventario con decremento automático, reseñas,
variantes (talla/color), historial de pedidos, multimoneda por producto. Quedan para una
fase futura.

## 12. Riesgos / consideraciones

- **Bottom nav con 6 items** en móvil: verificar legibilidad; mitigación dentro del estilo
  existente (icono + label pequeño). No se rediseña la navegación.
- **WhatsApp nulo**: el CTA se oculta/deshabilita si `gym_settings.whatsapp` no está
  configurado; se documenta para que el admin lo configure.
- **Imágenes huérfanas en Cloudinary** al eliminar productos: aceptado en esta fase; el
  borrado remoto queda como mejora futura.
- **Tasa BCV ausente** (0): mostrar solo precio USD si no hay tasa.
