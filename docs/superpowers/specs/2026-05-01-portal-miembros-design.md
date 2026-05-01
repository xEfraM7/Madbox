# Portal de Miembros — Diseño Técnico

**Fecha:** 2026-05-01  
**Estado:** Aprobado, pendiente de implementación  
**Alcance:** Feature completa de portal para miembros del gimnasio

---

## 1. Objetivo

Permitir que todos los miembros registrados en la app puedan autenticarse y acceder a un portal propio (`/portal/*`) donde visualizan su membresía, historial de pagos, catálogo de clases especiales y gestionan su perfil (datos + foto de perfil).

Los miembros tienen acceso **solo lectura** a la información de la app. No pueden modificar datos administrativos (plan, estado, fecha de pago, fondos, roles, cierres, etc.).

---

## 2. Modelo de datos

### 2.1 Cambios en la tabla `members`

```sql
ALTER TABLE members
  ADD COLUMN auth_user_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN avatar_url    text,
  ADD COLUMN must_change_password boolean NOT NULL DEFAULT true;

CREATE UNIQUE INDEX members_auth_user_id_idx
  ON members(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

CREATE UNIQUE INDEX members_email_lower_idx ON members(lower(email));
```

| Columna | Tipo | Descripción |
|---|---|---|
| `auth_user_id` | `uuid` | FK a `auth.users.id`. Puente entre el registro del miembro y su cuenta de autenticación. |
| `avatar_url` | `text` | URL pública de Cloudinary del avatar del miembro. |
| `must_change_password` | `boolean` | Si `true`, el middleware fuerza al miembro a `/portal/cambiar-contrasena` antes de acceder a cualquier otra ruta. |

### 2.2 RLS Policies nuevas

#### `members`
```sql
-- El miembro puede leer y actualizar solo su propia fila
CREATE POLICY "member_select_own" ON members
  FOR SELECT USING (auth_user_id = auth.uid());

CREATE POLICY "member_update_own" ON members
  FOR UPDATE USING (auth_user_id = auth.uid());
```

#### `payments`
```sql
-- El miembro puede leer sus propios pagos
CREATE POLICY "member_select_own_payments" ON payments
  FOR SELECT USING (
    member_id = (
      SELECT id FROM members WHERE auth_user_id = auth.uid()
    )
  );
```

#### `special_class_payments`
```sql
CREATE POLICY "member_select_own_class_payments" ON special_class_payments
  FOR SELECT USING (
    member_id = (
      SELECT id FROM members WHERE auth_user_id = auth.uid()
    )
  );
```

#### `special_classes` y `plans`
```sql
-- Lectura abierta a cualquier usuario autenticado (catálogo)
CREATE POLICY "authenticated_select_special_classes" ON special_classes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_select_plans" ON plans
  FOR SELECT TO authenticated USING (true);
```

> Las demás tablas (`admins`, `roles`, `gym_settings`, `monthly_closings`, `activity_logs`, etc.) siguen siendo solo para admins. Los miembros no tienen acceso.

---

## 3. Autenticación y Middleware

### 3.1 Rol y flags en metadata de auth

Al crear la cuenta de auth de un miembro se establece:
```json
{
  "app_metadata":  { "role": "member" },
  "user_metadata": { "must_change_password": true }
}
```

Al crear un admin (flujo existente) se establece:
```json
{ "app_metadata": { "role": "admin" } }
```

- `app_metadata.role` → leído en middleware para decidir redirección (requiere service_role para escribir).
- `user_metadata.must_change_password` → leído en middleware para forzar cambio de contraseña; puede ser actualizado por el propio usuario vía `supabase.auth.updateUser({ data: { must_change_password: false } })`.

**Backward compat para admins existentes:** Si `app_metadata.role` es nulo/undefined, el middleware hace una query a la tabla `admins` para verificar. Si existe → trata como admin y escribe `app_metadata.role = 'admin'` (backfill silencioso vía admin client). Después de la primera sesión de cada admin, el fallback nunca se activa.

### 3.2 Flujo de login

```
/login (compartido) 
  → Supabase Auth valida credenciales
  → middleware lee app_metadata.role
    → "admin"  → /dashboard
    → "member" → /portal
      → must_change_password = true → /portal/cambiar-contrasena
      → must_change_password = false → /portal
    → ninguno  → signOut() + /login?error=no-account
```

### 3.3 Cambios en `middleware.ts`

- `/dashboard/**` → exige `role = admin`. Si es miembro, redirige a `/portal`.
- `/portal/**` → exige `role = member`. Si es admin, redirige a `/dashboard`.
- `/portal/**` (excepto `/portal/cambiar-contrasena`) → si `must_change_password = true`, redirige a `/portal/cambiar-contrasena`.
- Rutas públicas sin cambio: `/`, `/login`, `/forgot-password`, `/reset-password`, `/auth/*`.

### 3.4 Contraseña inicial

Constante en `lib/actions/auth.ts`:
```ts
export const DEFAULT_MEMBER_PASSWORD = "Madbox2026"
```

---

## 4. Estructura de rutas y componentes

### 4.1 Rutas nuevas

```
app/portal/
  layout.tsx                        # Layout del portal
  page.tsx                          # /portal → PortalHomeMainComponent
  cambiar-contrasena/
    page.tsx                        # /portal/cambiar-contrasena → ChangePasswordMainComponent
  clases/
    page.tsx                        # /portal/clases → PortalClasesMainComponent
  pagos/
    page.tsx                        # /portal/pagos → PortalPagosMainComponent
  perfil/
    page.tsx                        # /portal/perfil → PortalPerfilMainComponent
```

### 4.2 Componentes nuevos

```
components/section-components/portal/
  home/
    PortalHomeMainComponent.tsx
    index.ts
  clases/
    PortalClasesMainComponent.tsx
    index.ts
  pagos/
    PortalPagosMainComponent.tsx
    index.ts
  perfil/
    PortalPerfilMainComponent.tsx
    index.ts
  change-password/
    ChangePasswordMainComponent.tsx
    index.ts
```

### 4.3 Layout del portal

`app/portal/layout.tsx`:
- Header: logo Madbox izquierda, nombre del miembro + avatar + botón logout derecha.
- Navegación: 4 items (Inicio, Clases, Pagos, Perfil) — barra inferior en mobile, sidebar mínimo en desktop.
- Banner sticky de estado (visible en todas las páginas excepto `/portal/cambiar-contrasena`):
  - `expired` → banner rojo: "Tu membresía venció. Habla con el gimnasio para renovar."
  - `frozen` → banner azul: "Tu cuenta está congelada temporalmente."

### 4.4 Contenido de cada página

| Ruta | Contenido |
|---|---|
| `/portal` | Badge de estado (active/expired/frozen), plan contratado, features del plan, fecha de vencimiento, días restantes |
| `/portal/clases` | Cards de `special_classes`: nombre, instructor, horario, precio, cupos restantes. Read-only. Indicador de inscripción si el miembro tiene pago registrado. |
| `/portal/pagos` | Tabla de `payments` propios: fecha, plan, monto, método, referencia, estado. Solo lectura. |
| `/portal/perfil` | Form de edición: `name`, `phone`, `email` + uploader de avatar. Botón "Cambiar contraseña" que lleva a `/portal/cambiar-contrasena`. |
| `/portal/cambiar-contrasena` | Form: nueva contraseña + confirmar. Mínimo 8 chars. Post-éxito → `must_change_password = false` + redirect a `/portal`. |

---

## 5. Server Actions

**Archivo:** `lib/actions/portal.ts`

| Función | Descripción |
|---|---|
| `getMyProfile()` | Retorna la fila de `members` del usuario actual con join a `plans` |
| `updateMyProfile(data)` | Whitelist explícita: solo `name`, `phone`, `email`. Si cambia email, llama `supabase.auth.updateUser({ email })` también |
| `getMyPayments()` | Retorna `payments` donde `member_id` = id del miembro actual, ordenados por `payment_date` desc |
| `getMyClasses()` | Retorna `special_class_payments` del miembro con join a `special_classes` |
| `getActiveSpecialClasses()` | Retorna todas las `special_classes` (catálogo completo) |
| `updateAvatar(url: string)` | Actualiza `members.avatar_url` con la URL de Cloudinary |
| `clearMustChangePassword()` | Setea `members.must_change_password = false` + `supabase.auth.updateUser({ data: { must_change_password: false } })` |
| `uploadAvatarToCloudinary(formData: FormData)` | Sube imagen a Cloudinary server-side, retorna `secure_url` |

---

## 6. Integración con flujo admin existente

### 6.1 Creación de miembro (modal existente)

`lib/actions/members.ts` → `createMember()`:
- Después del INSERT exitoso, llamar `supabase.auth.admin.createUser({ email, password: DEFAULT_MEMBER_PASSWORD, app_metadata: { role: 'member' }, email_confirm: true })`.
- Actualizar `members.auth_user_id` con el `user.id` retornado.
- Si la creación de auth falla, no revertir el miembro (el admin puede usar la migración después). Loguear warning.

### 6.2 Eliminación de miembro

`deleteMembers()`: si `auth_user_id` no es null, llamar `supabase.auth.admin.deleteUser(auth_user_id)` antes de eliminar la fila.

### 6.3 Botón de migración (Settings)

`lib/actions/migration.ts` → `migrateMembersToPortal()`:
- Solo ejecutable por admin (`isAdmin` check, usa cliente admin de `utils/supabase/admin.ts`).
- Itera `members` donde `auth_user_id IS NULL`.
- Por cada registro: `auth.admin.createUser(...)` + `UPDATE members SET auth_user_id = ..., must_change_password = true`.
- Retorna `{ success: number, failed: number, errors: string[] }`.
- Se expone en `components/section-components/settings/` como un botón con confirmación SweetAlert2.

---

## 7. Cloudinary — Integración de avatares

### 7.1 Setup

```bash
npm install cloudinary
```

Nuevas variables de entorno:
```
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

### 7.2 Flujo de upload

1. Usuario selecciona imagen en `/portal/perfil` (client-side preview).
2. `FormData` se envía a Server Action `uploadAvatarToCloudinary()`.
3. Server Action usa `cloudinary.uploader.upload()` con:
   - `folder: "madbox/avatars"`
   - `public_id: members.id` (sobrescribe versiones anteriores automáticamente)
   - `transformation: [{ width: 400, height: 400, crop: "fill", gravity: "face" }]`
4. Retorna `secure_url` → llama `updateAvatar(url)` → toast de éxito.

Límite de archivo: validación client-side 2MB, formatos JPG/PNG/WebP.

---

## 8. Edge cases

| Caso | Manejo |
|---|---|
| Miembro accede a `/dashboard/*` | Middleware redirige a `/portal` |
| Admin accede a `/portal/*` | Middleware redirige a `/dashboard` |
| `must_change_password = true` navega fuera de `/portal/cambiar-contrasena` | Middleware redirige a `/portal/cambiar-contrasena` |
| Miembro `expired` o `frozen` | Entra al portal, ve banner de estado |
| Email ya existe en `auth.users` durante migración | Script omite, registra en array `errors`, continúa |
| Upload de imagen falla en Cloudinary | Server Action lanza error, toast de error, `avatar_url` no se modifica |
| Miembro cambia email | `members.email` + `auth.updateUser({ email })` — Supabase envía verificación automática |
| Campos admin-only en `updateMyProfile` | Whitelist explícita en Server Action — campos no listados son ignorados aunque vengan en el payload |
| Miembro sin `auth_user_id` (no migrado) | No puede autenticarse — admin corre migración desde Settings |

---

## 9. Archivos modificados vs nuevos

### Nuevos
- `app/portal/layout.tsx`
- `app/portal/page.tsx`
- `app/portal/cambiar-contrasena/page.tsx`
- `app/portal/clases/page.tsx`
- `app/portal/pagos/page.tsx`
- `app/portal/perfil/page.tsx`
- `components/section-components/portal/` (5 componentes)
- `lib/actions/portal.ts`
- `lib/actions/migration.ts`
- Migration SQL (columnas + RLS policies)

### Modificados
- `middleware.ts` — lógica de rol por `app_metadata`
- `lib/actions/members.ts` — `createMember()` y `deleteMember()` integran auth
- `components/section-components/users/modals/user-form-modal.tsx` — feedback de cuenta creada
- `components/section-components/settings/SettingsMainComponent.tsx` — botón de migración
- `.env` — 3 variables Cloudinary
- `types/database.ts` — regenerar tras migración SQL
- `package.json` — agregar `cloudinary`

---

## 10. Dependencias y variables necesarias del usuario

Antes de iniciar la implementación, el usuario debe proveer:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Confirmar contraseña fija: **`Madbox2026`** ✓
