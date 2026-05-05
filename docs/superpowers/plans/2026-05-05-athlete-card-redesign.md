# Athlete Card Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portar el diseño Editorial (Mockup B) al `AthleteCard.tsx` real, ajustar `getMyAthleteCardData` para que devuelva los 3 levantamientos olímpicos (Snatch / Clean & Jerk / Jerk) en orden fijo, y eliminar la pestaña temporal de mockups.

**Architecture:** La server action emite un shape denso: `topRecords` siempre tiene 3 entradas en orden (`snatch` → `clean_and_jerk` → `split_jerk`), con `weightKg = 0` si el miembro no registró el levantamiento. El componente `AthleteCard.tsx` se reescribe con inline styles hex (cero `oklch`, cero clases Tailwind para color) para que `html-to-image` capture sin regresiones. Cleanup borra la página `/portal/mockups-ficha`, la carpeta `components/section-components/portal/mockups/`, y la entrada de navegación temporal.

**Tech Stack:** Next.js 16 (App Router, Server Actions), React 19, TypeScript strict, html-to-image 1.11, lucide-react.

**Spec:** [docs/superpowers/specs/2026-05-05-athlete-card-redesign-design.md](../specs/2026-05-05-athlete-card-redesign-design.md)

**Estado previo (ya hecho, fuera de este plan):**
- `lib/constants/movements.ts` — añadidas `OLYMPIC_DISPLAY_MOVEMENTS` y `OLYMPIC_DISPLAY_LABEL`.
- `lib/actions/records.ts` — `getDiscoverableMembers` y `getMemberPublicProfile` devuelven los 3 olímpicos en `top_records`.
- `components/section-components/portal/descubrir/MemberCard.tsx` — render fijo de los 3 con "—" para 0.
- `components/section-components/portal/descubrir/MemberDetailModal.tsx` — strip "Levantamientos Olímpicos" añadido.
- `components/section-components/portal/mockups/*` — mockups de exploración (a borrar en Task 3).

**Verificación:** este proyecto no tiene tests automatizados; cada task se valida con `npx tsc --noEmit` (type-check) y prueba manual en `npm run dev` según el plan de testing del spec. Los commits son por task; si el flujo del proyecto exige confirmación, pedírsela al user antes de cada `git commit`.

---

## File Structure

| Archivo | Acción | Responsabilidad |
| ------- | ------ | --------------- |
| `lib/actions/portal.ts` | Modify | `getMyAthleteCardData` — emitir 3 olímpicos fijos en `topRecords`, etiqueta corta vía `OLYMPIC_DISPLAY_LABEL` |
| `components/section-components/portal/perfil/AthleteCard.tsx` | Rewrite | Render editorial 1080×1920 con data real, logo del oso, subtítulo nivel+desde, levantamientos olímpicos hero |
| `app/portal/mockups-ficha/page.tsx` | Delete | Página temporal de exploración |
| `components/section-components/portal/mockups/` | Delete folder | Mockups de brainstorming (`MockupBento.tsx`, `MockupEditorial.tsx`, `MockupTech.tsx`, `mockup-data.ts`) |
| `app/portal/layout.tsx` | Modify | Quitar item "Mockups" del array `nav` y el icono `Palette` del import |

---

## Task 1: Actualizar `getMyAthleteCardData` para devolver los 3 olímpicos

**Files:**
- Modify: `lib/actions/portal.ts` (imports y función `getMyAthleteCardData`)

- [ ] **Step 1: Cambiar el import de `MOVEMENTS` por `OLYMPIC_DISPLAY_MOVEMENTS` y `OLYMPIC_DISPLAY_LABEL`**

Abrir `lib/actions/portal.ts`. Reemplazar:

```ts
import { calculateTotals, MOVEMENTS } from "@/lib/constants/movements"
```

Por:

```ts
import {
  calculateTotals,
  OLYMPIC_DISPLAY_MOVEMENTS,
  OLYMPIC_DISPLAY_LABEL,
} from "@/lib/constants/movements"
```

- [ ] **Step 2: Sustituir el cálculo de `topRecords` dentro de `getMyAthleteCardData`**

Localizar el bloque actual (alrededor de las líneas 224-232):

```ts
const topRecords = MOVEMENTS
  .map((mv) => ({
    movement: mv.id,
    label: mv.label,
    weightKg: recsMap[mv.id] ?? 0,
  }))
  .filter((r) => r.weightKg > 0)
  .sort((a, b) => b.weightKg - a.weightKg)
  .slice(0, 6)
```

Reemplazarlo por:

```ts
// Siempre los 3 levantamientos olímpicos destacados, en orden fijo.
// weightKg = 0 indica que el miembro no tiene esa marca registrada.
const topRecords = OLYMPIC_DISPLAY_MOVEMENTS.map((mv) => ({
  movement: mv,
  label: OLYMPIC_DISPLAY_LABEL[mv],
  weightKg: recsMap[mv] ?? 0,
}))
```

- [ ] **Step 3: Verificar que `recsMap` sigue cumpliendo el contrato esperado**

Confirmar que la línea inmediatamente anterior al bloque modificado sigue siendo:

```ts
const recsMap: Record<string, number> = {}
for (const r of records) recsMap[r.movement] = Number(r.weight_kg)
```

Y que `OLYMPIC_DISPLAY_MOVEMENTS` es `MovementId[]` (en `lib/constants/movements.ts`), así que `recsMap[mv]` se resuelve por movimiento concreto.

No tocar el resto de la función (gates `member.gender === null`, `records.length === 0`, cálculo de `totals`, age, planName, etc.).

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: Sin errores. Si aparece `'MOVEMENTS' is declared but never read`, eliminar referencias huérfanas (no debería haberlas tras el cambio del Step 1).

- [ ] **Step 5: Verificación de runtime básica**

Run: `npm run dev`
Abrir `/portal/perfil`, click en el botón "Compartir mi ficha" (con un usuario que tenga al menos una marca registrada). Si falla con error técnico (no un error de validación esperado tipo "Registra al menos una marca…"), revertir y debugear. Si dispara la captura, OK — el visual será revisado en Task 2 después del rewrite.

- [ ] **Step 6: Commit**

```bash
git add lib/actions/portal.ts
git commit -m "$(cat <<'EOF'
feat(perfil): topRecords devuelve los 3 levantamientos olímpicos en orden fijo

getMyAthleteCardData ahora siempre emite Snatch, Clean & Jerk y Jerk
(split_jerk) en ese orden, con weightKg=0 cuando el miembro no tiene
esa marca registrada. La etiqueta usa OLYMPIC_DISPLAY_LABEL para que
split_jerk se muestre como "Jerk" en este contexto destacado.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Reescribir `AthleteCard.tsx` con el diseño Editorial

**Files:**
- Modify (rewrite completo): `components/section-components/portal/perfil/AthleteCard.tsx`

- [ ] **Step 1: Reemplazar el contenido completo de `AthleteCard.tsx`**

Sobrescribir el archivo `components/section-components/portal/perfil/AthleteCard.tsx` con:

```tsx
"use client"

import { ATHLETE_LEVEL_LABEL } from "@/lib/constants/athlete"
import type { AthleteCardData } from "@/lib/actions/portal"

interface Props {
  data: AthleteCardData
  /** ref al div raíz, lo usa el hook para capturar */
  innerRef?: React.RefObject<HTMLDivElement | null>
}

const C = {
  bg0: "#050505",
  bg1: "#0a0a0a",
  accent: "#FACC15",
  accentSoft: "rgba(250, 204, 21, 0.15)",
  text: "#fafafa",
  muted: "#a1a1aa",
  border: "rgba(250, 204, 21, 0.4)",
  borderSoft: "rgba(250, 204, 21, 0.18)",
}

export function AthleteCard({ data, innerRef }: Props) {
  const initials = data.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  const levelLabel = data.athleteLevel ? ATHLETE_LEVEL_LABEL[data.athleteLevel].toUpperCase() : null
  const subtitleParts = [
    levelLabel,
    data.athleteSinceYear ? `DESDE ${data.athleteSinceYear}` : null,
  ].filter(Boolean) as string[]
  const subtitle = subtitleParts.join(" · ")

  const hasAnyBodyMetric =
    data.age !== null || data.weightKg !== null || data.heightCm !== null

  return (
    <div
      ref={innerRef}
      style={{
        position: "fixed",
        left: "-99999px",
        top: 0,
        width: 1080,
        height: 1920,
        background: `linear-gradient(180deg, ${C.bg0} 0%, ${C.bg1} 100%)`,
        color: C.text,
        fontFamily: "'Geist', Georgia, serif",
        padding: 80,
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        pointerEvents: "none",
        zIndex: -1,
      }}
    >
      {/* Logo del oso */}
      <img
        src="/Madbox_logo.jpeg"
        alt="Madbox"
        crossOrigin="anonymous"
        style={{
          width: 110,
          height: 110,
          borderRadius: "50%",
          border: `2px solid ${C.border}`,
          objectFit: "cover",
        }}
      />
      <p
        style={{
          margin: "20px 0 0 0",
          fontSize: 14,
          letterSpacing: 10,
          color: C.accent,
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        — The Athlete File —
      </p>

      {/* Avatar con ticks decorativos */}
      <div style={{ marginTop: 60, position: "relative" }}>
        <div
          style={{
            width: 380,
            height: 380,
            borderRadius: "50%",
            border: `3px solid ${C.accent}`,
            background: `linear-gradient(135deg, ${C.accentSoft}, transparent)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {data.avatarUrl ? (
            <img
              src={data.avatarUrl}
              alt={data.name}
              crossOrigin="anonymous"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span
              style={{
                fontSize: 140,
                fontWeight: 900,
                color: C.accent,
                fontFamily: "'Bebas Neue', Impact, sans-serif",
                letterSpacing: 6,
              }}
            >
              {initials}
            </span>
          )}
        </div>
        <div style={{ position: "absolute", top: -20, left: "50%", width: 2, height: 30, background: C.accent, transform: "translateX(-50%)" }} />
        <div style={{ position: "absolute", bottom: -20, left: "50%", width: 2, height: 30, background: C.accent, transform: "translateX(-50%)" }} />
        <div style={{ position: "absolute", top: "50%", left: -30, width: 30, height: 2, background: C.accent, transform: "translateY(-50%)" }} />
        <div style={{ position: "absolute", top: "50%", right: -30, width: 30, height: 2, background: C.accent, transform: "translateY(-50%)" }} />
      </div>

      {/* Nombre */}
      <h1
        style={{
          margin: "56px 0 0 0",
          fontSize: 124,
          fontWeight: 900,
          textAlign: "center",
          letterSpacing: 6,
          textTransform: "uppercase",
          fontFamily: "'Bebas Neue', Impact, sans-serif",
          lineHeight: 0.95,
        }}
      >
        {data.name}
      </h1>

      {/* Subtítulo: NIVEL · DESDE AÑO (con fallbacks) */}
      {subtitle && (
        <div style={{ display: "flex", alignItems: "center", gap: 24, marginTop: 28 }}>
          <div style={{ width: 70, height: 1, background: C.accent }} />
          <p
            style={{
              margin: 0,
              fontSize: 22,
              color: C.muted,
              letterSpacing: 8,
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            {subtitle}
          </p>
          <div style={{ width: 70, height: 1, background: C.accent }} />
        </div>
      )}

      {/* Stats row: EDAD / PESO / ALTURA */}
      {hasAnyBodyMetric && (
        <div
          style={{
            marginTop: 64,
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            width: "100%",
            gap: 16,
            paddingTop: 32,
            paddingBottom: 32,
            borderTop: `1px solid ${C.borderSoft}`,
            borderBottom: `1px solid ${C.borderSoft}`,
          }}
        >
          {[
            { label: "EDAD", value: data.age, unit: "años" },
            { label: "PESO", value: data.weightKg, unit: "kg" },
            { label: "ALTURA", value: data.heightCm, unit: "cm" },
          ].map((s, i) => (
            <div
              key={i}
              style={{
                textAlign: "center",
                borderLeft: i === 0 ? "none" : `1px solid ${C.borderSoft}`,
                padding: "0 8px",
              }}
            >
              <p style={{ fontSize: 14, color: C.muted, letterSpacing: 4, margin: 0, fontWeight: 700 }}>
                {s.label}
              </p>
              <p
                style={{
                  fontSize: 72,
                  fontWeight: 900,
                  margin: "8px 0 0 0",
                  fontFamily: "'Bebas Neue', Impact, sans-serif",
                  color: C.text,
                  lineHeight: 1,
                }}
              >
                {s.value ?? "—"}
              </p>
              {s.value !== null && (
                <p style={{ fontSize: 14, color: C.muted, margin: "4px 0 0 0", letterSpacing: 2 }}>
                  {s.unit.toUpperCase()}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Quote */}
      {data.quote && (
        <p
          style={{
            marginTop: 48,
            fontSize: 32,
            fontStyle: "italic",
            color: C.text,
            textAlign: "center",
            maxWidth: 800,
            lineHeight: 1.4,
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontWeight: 400,
            letterSpacing: 0.5,
          }}
        >
          &ldquo;{data.quote}&rdquo;
        </p>
      )}

      {/* Levantamientos olímpicos (siempre visibles, "—" si peso es 0) */}
      <p
        style={{
          marginTop: 56,
          fontSize: 16,
          color: C.accent,
          letterSpacing: 10,
          textAlign: "center",
          fontWeight: 700,
          textTransform: "uppercase",
        }}
      >
        Levantamientos Olímpicos
      </p>
      <div
        style={{
          marginTop: 28,
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          width: "100%",
          gap: 24,
        }}
      >
        {data.topRecords.map((r, i) => (
          <div
            key={r.movement}
            style={{
              textAlign: "center",
              borderLeft: i === 0 ? "none" : `1px solid ${C.borderSoft}`,
              padding: "8px 4px",
            }}
          >
            <p
              style={{
                fontSize: 14,
                color: C.muted,
                letterSpacing: 4,
                margin: 0,
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              {r.label}
            </p>
            <p
              style={{
                fontSize: 96,
                fontWeight: 900,
                margin: "10px 0 0 0",
                fontFamily: "'Bebas Neue', Impact, sans-serif",
                color: C.accent,
                lineHeight: 1,
                letterSpacing: 2,
              }}
            >
              {r.weightKg > 0 ? r.weightKg.toLocaleString("es-VE") : "—"}
            </p>
            {r.weightKg > 0 && (
              <p style={{ fontSize: 16, color: C.muted, margin: "4px 0 0 0", letterSpacing: 4, fontWeight: 700 }}>
                KG
              </p>
            )}
          </div>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      {/* Grand Total (solo si hay algo que sumar) */}
      {data.totals.grand > 0 && (
        <div
          style={{
            marginTop: 32,
            padding: "28px 64px",
            textAlign: "center",
            borderTop: `2px solid ${C.accent}`,
            borderBottom: `2px solid ${C.accent}`,
            width: "100%",
            maxWidth: 700,
          }}
        >
          <p style={{ fontSize: 16, color: C.muted, letterSpacing: 10, fontWeight: 700, margin: 0 }}>
            GRAND TOTAL
          </p>
          <p
            style={{
              fontSize: 120,
              fontWeight: 900,
              color: C.accent,
              fontFamily: "'Bebas Neue', Impact, sans-serif",
              margin: "8px 0 0 0",
              letterSpacing: 6,
              lineHeight: 1,
            }}
          >
            {data.totals.grand.toLocaleString("es-VE")}{" "}
            <span style={{ fontSize: 60, color: C.text }}>KG</span>
          </p>
        </div>
      )}

      {/* Footer */}
      <p
        style={{
          marginTop: 28,
          fontSize: 14,
          color: C.muted,
          letterSpacing: 12,
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        the madbox · crossfit elite
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: Sin errores. Si aparece error en `data.athleteLevel`, confirmar que `AthleteCardData.athleteLevel` admite `null` (lo hace por el spec previo, pero verificar la firma actual del tipo en `lib/actions/portal.ts`).

- [ ] **Step 3: Smoke en navegador — escenario "feliz"**

Run: `npm run dev`. Loguearse como un miembro que tenga:
- gender ≠ null,
- al menos 1 record en `personal_records`,
- los 3 olímpicos (Snatch, Clean & Jerk, Split Jerk) registrados,
- nivel "Rx", peso, altura, edad y quote rellenos.

Ir a `/portal/perfil` → click en "Compartir mi ficha". Si la imagen sale:
- con el oso arriba, sello "— THE ATHLETE FILE —", avatar con ticks decorativos,
- nombre en mayúsculas grande, subtítulo "RX · DESDE [año]",
- 3 stats (Edad/Peso/Altura), quote en cursiva,
- 3 levantamientos olímpicos en dorado (Snatch / Clean & Jerk / Jerk),
- Grand Total dentro de doble línea dorada,
- footer "the madbox · crossfit elite",

→ pasar al Step 4. Si sale negra o rota, abrir DevTools, revisar consola y network del PNG generado, comparar con el mockup B en `/portal/mockups-ficha`.

- [ ] **Step 4: Smoke — escenarios edge**

Probar (con cuentas distintas o ajustando datos en Supabase con cuidado):
- Sin athlete_level: subtítulo cae a "DESDE [año]".
- Sin athlete_since_year: si tampoco hay nivel, la línea entera del subtítulo NO aparece (verificar que las dos rayas finas también desaparecen).
- Sin records de ninguno de los 3 olímpicos pero con otros (ej. Back Squat + Deadlift): la sección "LEVANTAMIENTOS OLÍMPICOS" muestra los 3 labels con "—" y el Grand Total muestra la suma de squat+deadlift.
- Sin avatar: aparecen las iniciales en dorado dentro del círculo.
- Sin quote: la cursiva no aparece y los olímpicos suben.

- [ ] **Step 5: Smoke en iOS Safari (si hay dispositivo a mano)**

Generar la ficha desde un iPhone real. Verificar que la imagen NO sale completamente negra (regression del bug previo). Si sale negra, revisar en `lib/hooks/use-share-athlete-card.ts` que el `style` override está intacto:

```ts
style: {
  position: "static",
  left: "0",
  top: "0",
  margin: "0",
  zIndex: "auto",
}
```

(Este parche ya está en main; este step es una verificación, no un cambio.)

- [ ] **Step 6: Commit**

```bash
git add components/section-components/portal/perfil/AthleteCard.tsx
git commit -m "$(cat <<'EOF'
feat(perfil): rediseño editorial de la ficha de atleta

Porta el mockup B (Editorial Magazine): logo del oso, sello tipográfico,
avatar con ticks decorativos, nombre en Bebas Neue 124px, subtítulo
NIVEL · DESDE AÑO entre rayas doradas, stats de 3 columnas (edad/peso/
altura) sin cajas, quote en cursiva Georgia, sección destacada
"LEVANTAMIENTOS OLÍMPICOS" con los 3 hero numbers en dorado, y Grand
Total en doble línea dorada.

Sustituye el avatar antes mostrado, las 4 stat cards y los 6 records
genéricos por una composición más elegante y compartible.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Cleanup de la página y carpeta de mockups

**Files:**
- Delete: `app/portal/mockups-ficha/page.tsx`
- Delete folder: `components/section-components/portal/mockups/`
- Modify: `app/portal/layout.tsx`

- [ ] **Step 1: Borrar la página de mockups**

Run: `rm app/portal/mockups-ficha/page.tsx`

Si la carpeta `app/portal/mockups-ficha/` queda vacía, eliminarla también:

Run: `rmdir app/portal/mockups-ficha`

- [ ] **Step 2: Borrar la carpeta de componentes de mockups**

Run: `rm -rf components/section-components/portal/mockups`

Esto borra `MockupBento.tsx`, `MockupEditorial.tsx`, `MockupTech.tsx` y `mockup-data.ts`.

- [ ] **Step 3: Quitar el item "Mockups" y el icono `Palette` del nav**

Editar `app/portal/layout.tsx`:

Cambiar la línea de import de lucide-react:

```tsx
import { Home, Calendar, CreditCard, User, LogOut, Menu, X, Compass, Flame, CalendarDays, Palette } from "lucide-react"
```

Por:

```tsx
import { Home, Calendar, CreditCard, User, LogOut, Menu, X, Compass, Flame, CalendarDays } from "lucide-react"
```

Y eliminar la entrada de mockups del array `nav`. Antes:

```tsx
  { name: "Perfil", href: "/portal/perfil", icon: User },
  { name: "Mockups", href: "/portal/mockups-ficha", icon: Palette },
]
```

Después:

```tsx
  { name: "Perfil", href: "/portal/perfil", icon: User },
]
```

- [ ] **Step 4: Type-check + grep de referencias huérfanas**

Run: `npx tsc --noEmit`
Expected: Sin errores.

Run de seguridad para confirmar que no quedó nada apuntando a la carpeta o página borradas:

Use the Grep tool con los patrones `mockups-ficha`, `MockupBento`, `MockupEditorial`, `MockupTech`, `mockup-data` (en `**/*.{ts,tsx}`).
Expected: cero matches en código de aplicación. (Pueden quedar referencias en `docs/superpowers/specs/` o `docs/superpowers/plans/` — eso es histórico, no se toca.)

- [ ] **Step 5: Smoke**

Run: `npm run dev`
Visitar `/portal/mockups-ficha` directamente en el navegador.
Expected: Next.js devuelve 404. La pestaña "Mockups" ya no aparece en la barra ni en el bottom nav móvil.

Visitar `/portal` y `/portal/perfil` para confirmar que el layout sigue intacto (los demás items del nav presentes y el spacing correcto).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore(portal): cleanup de la pestaña temporal de mockups

Elimina app/portal/mockups-ficha/, components/section-components/portal/
mockups/ y la entrada de navegación + icono Palette del layout. Era una
exploración de brainstorming; el ganador (Mockup B) ya está portado al
AthleteCard real.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Smoke end-to-end completo

**Files:** ninguno (verificación manual sobre el árbol post-Task-3).

- [ ] **Step 1: Levantar el dev server limpio**

Run: `npm run dev`

Esperar a que compile sin errores. Si Next.js reporta warnings sobre imports faltantes, revisar Tasks 2 y 3.

- [ ] **Step 2: Recorrido en `/portal/descubrir`**

Loguearse, abrir `/portal/descubrir`. Verificar:
- Tab Hombres y Mujeres muestran cards.
- Cada `MemberCard` lista exactamente 3 entradas: Snatch, Clean & Jerk, Jerk (en ese orden), con peso o "—".
- Click en una card abre `MemberDetailModal`.
- En el modal aparece la tira destacada "Levantamientos Olímpicos" con los 3 números grandes en dorado, justo después del `TotalsStrip`.
- Abajo del modal el desglose por familia sigue presente (Halterofilia muestra Snatch + Clean & Jerk; Presses & Jerks muestra Push Jerk + Split Jerk separados).

- [ ] **Step 3: Recorrido en `/portal/perfil` → ficha PNG**

Click en "Compartir mi ficha". Verificar:
- La imagen generada es PNG, no negra.
- Coincide con la composición del Editorial: logo del oso, "— THE ATHLETE FILE —", avatar + ticks, nombre, subtítulo nivel+desde, 3 stats, quote, 3 olímpicos hero, Grand Total, footer.
- Si el navegador dispara Web Share API (móvil), aparece el sheet de compartir; si no (desktop), descarga directa.

- [ ] **Step 4: Type-check final**

Run: `npx tsc --noEmit`
Expected: Sin errores.

- [ ] **Step 5: (Opcional) Lint**

Run: `npm run lint`
Expected: Sin nuevos warnings introducidos por estos cambios.

- [ ] **Step 6: Cierre**

No hace falta commit (Tasks 1-3 ya cubren todo). Si durante el smoke salieron ajustes menores (typos, espacios), hacerlos aquí en un commit `chore: ajustes menores tras smoke`.

---

## Self-Review (pre-handoff)

Cobertura del spec:

| Spec section | Task |
| ------------ | ---- |
| Decisión "Jerk = split_jerk" | Cubierto en Task 1 (label vía `OLYMPIC_DISPLAY_LABEL`) |
| Semántica nueva de `top_records` (action de portal) | Task 1 |
| Diseño visual editorial (logo oso, ticks, subtítulo, stats 3-col, olímpicos hero, grand total) | Task 2 |
| Edge case "sin records olímpicos pero con otros" | Task 2 Step 4 (smoke) — el componente lo soporta vía `r.weightKg > 0 ? ... : "—"` |
| Edge case "sin athlete_level / sin athlete_since_year" | Task 2 Step 4 (smoke) — `subtitle` se construye con filter(Boolean) |
| Edge case "sin avatar" | Task 2 Step 4 (smoke) — fallback a iniciales |
| Captura en iOS Safari | Task 2 Step 5 — verificación, no cambio |
| Cleanup de mockups | Task 3 |
| Plan de testing manual del spec | Task 4 |

Sin placeholders ("TBD", "TODO", "implement later"). Cada step que cambia código incluye el código completo. Los tipos referenciados (`AthleteCardData`, `MovementId`, `OLYMPIC_DISPLAY_MOVEMENTS`, `OLYMPIC_DISPLAY_LABEL`, `ATHLETE_LEVEL_LABEL`) ya existen en el árbol.
