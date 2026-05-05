# Portal — Rediseño de la ficha de atleta y "Levantamientos Olímpicos" en Descubrir

**Fecha:** 2026-05-05
**Sección afectada:** Portal de miembros (`/portal/perfil` ficha PNG, `/portal/descubrir` cards y modal)
**Estado:** Diseño aprobado, pendiente plan de implementación
**Spec previo relacionado:** `2026-05-04-portal-athlete-profile-design.md` (introdujo la ficha original).

---

## Contexto

La ficha compartible (`AthleteCard.tsx`) que se exporta como PNG funciona pero el diseño es plano: gradiente negro, líneas finas doradas, grid uniforme de 4 stats, records con borde, total grande al final. Se sentía "genérico de gimnasio". Además:

1. Usaba `/madbox-logo.svg` (texto plano "MADBOX" en amarillo). El logo real de marca es `/Madbox_logo.jpeg` (oso dorado con "THE MADBOX"). La marca debe estar presente en la ficha exportable.
2. El campo "Plan" ocupaba un lugar prominente cuando la información identitaria del atleta es su **nivel** (Rx / Scaled / Beginner), no la categoría comercial del plan.
3. La sección de records mostraba los **6 movimientos con más peso** del atleta (variable y poco comparable entre miembros).

En Descubrir (`MemberCard` y `MemberDetailModal`) sucedía lo mismo: cada card mostraba el "top 3 por peso" del miembro, lo que hacía imposible comparar atletas (uno tenía Back Squat / Deadlift / Front Squat, otro tenía Snatch / Clean & Jerk / Bench Press).

Este rediseño:

1. Reemplaza la ficha visual por la dirección **Editorial Magazine** (Mockup B, ya validado en `/portal/mockups-ficha`).
2. Usa el logo real del oso (`/Madbox_logo.jpeg`) en la ficha.
3. Reemplaza "Plan" por **Nivel del atleta** en el subtítulo de la ficha.
4. Estandariza la visualización de records destacados a los **3 levantamientos olímpicos clave**: Snatch, Clean & Jerk y Jerk (mapeado a `split_jerk` en backend, etiquetado "Jerk" en el front en estos contextos destacados). Esto aplica tanto a la ficha como a Descubrir (cards y modal).

## Objetivos

- La ficha PNG exportable refleja la identidad de Madbox: oscura, dorada, oso visible, tipografía editorial, jerarquía clara.
- Cualquier miembro logueado puede comparar a sus pares por los **mismos 3 levantamientos olímpicos** en Descubrir.
- El cambio en `getDiscoverableMembers` y `getMemberPublicProfile` mantiene compatibilidad de tipos (`top_records` sigue siendo `Array<{ movement, weight_kg }>`), solo cambia la **semántica**: orden y movimientos ahora son fijos.
- La ficha sigue funcionando con el flujo de captura existente (`useShareAthleteCard` + `html-to-image` con la opción `style` ya añadida para evitar el bug de "negro completo").

## Fuera de alcance

- Generación server-side de la ficha (sigue siendo client-side con `html-to-image`).
- OG preview público o URL compartible — la imagen sigue siendo el artefacto.
- Personalización por miembro de los 3 levantamientos destacados (siempre Snatch / C&J / Jerk para todos).
- Mostrar más de 3 levantamientos en la ficha (los demás records siguen viviendo en `/portal/perfil` pestaña Marcas, sin cambios).
- Cambios al flujo de privacidad (`show_rms`, `show_body_metrics`, etc. siguen igual).
- Soporte para usuarios sin género (sigue gateado por la regla existente: la ficha requiere `gender`).

---

## Decisiones clave

### 1. "Jerk" = `split_jerk`

El proyecto no tiene un movimiento `jerk` aislado. Tiene `push_jerk` y `split_jerk`. **Decisión: usar `split_jerk`** porque es el jerk olímpico estándar en competición.

Etiqueta:

- En contextos donde "Jerk" aparece junto a Snatch y Clean & Jerk (ficha exportable, strip de levantamientos olímpicos en Descubrir) → label corta **"Jerk"**.
- En el desglose por familia del modal de Descubrir → sigue siendo **"Split Jerk"** (donde convive con "Push Jerk" y la distinción importa).

Esto se modela con dos constantes en `lib/constants/movements.ts`:

```ts
export const OLYMPIC_DISPLAY_MOVEMENTS: MovementId[] = [
  'snatch',
  'clean_and_jerk',
  'split_jerk',
]

export const OLYMPIC_DISPLAY_LABEL: Record<MovementId, string> = {
  snatch: 'Snatch',
  clean_and_jerk: 'Clean & Jerk',
  split_jerk: 'Jerk',
} as Record<MovementId, string>
```

### 2. Semántica de `top_records`

Antes:

```ts
top_records: Array<{ movement: MovementId; weight_kg: number }>
// → top 3 movimientos con más peso del miembro, ordenados desc
```

Ahora:

```ts
top_records: Array<{ movement: MovementId; weight_kg: number }>
// → siempre 3 entradas en orden fijo: snatch, clean_and_jerk, split_jerk
// → weight_kg = 0 si el miembro no tiene esa marca registrada
```

El consumidor del front filtra `weight_kg > 0` para decidir si mostrar valor o "—". El nombre del campo se mantiene (`top_records`) para no romper otros consumidores. El comentario en el código deja explícita la nueva semántica.

### 3. Diseño visual: Editorial Magazine

Validado en `/portal/mockups-ficha` como mockup B. Características:

- Fondo oscuro `linear-gradient(180deg, #050505 → #0a0a0a)`.
- Logo del oso (`/Madbox_logo.jpeg`) circular 110px con borde dorado, centrado arriba.
- Sello tipográfico "— THE ATHLETE FILE —" en dorado, letter-spacing alto.
- Avatar 380px circular, borde 3px dorado, ticks decorativos en N/S/E/O (líneas finas doradas que rompen el círculo y refuerzan la simetría editorial).
- Nombre en Bebas Neue 124px, mayúsculas, letter-spacing 6.
- Subtítulo: `[NIVEL] · DESDE [AÑO]` entre dos líneas finas doradas.
- Stats row de 3 columnas (Edad, Peso, Altura) sin cajas, separadores verticales finos, top y bottom border 1px dorado suave.
- Quote en Georgia italic 32px, centrada, con comillas inglesas, max-width 800px.
- Bloque destacado **"LEVANTAMIENTOS OLÍMPICOS"** — 3 columnas con números enormes (96px Bebas Neue dorado), label arriba, "KG" abajo, separadores verticales finos.
- Grand Total en doble línea horizontal dorada (top + bottom 2px), número 120px Bebas Neue dorado.
- Footer "the madbox · crossfit elite" en uppercase letter-spacing 12.

Paleta:

| Variable      | Hex / valor                       |
| ------------- | --------------------------------- |
| `bg0`         | `#050505`                         |
| `bg1`         | `#0a0a0a`                         |
| `accent`      | `#FACC15`                         |
| `accentSoft`  | `rgba(250, 204, 21, 0.15)`        |
| `text`        | `#fafafa`                         |
| `muted`       | `#a1a1aa`                         |
| `borderSoft`  | `rgba(250, 204, 21, 0.18)`        |

**Importante:** todos los colores en hex / rgba. Cero `oklch()` (incompatible con `html-to-image` en Safari iOS y causa de un bug previo).

Tipografías:

- `'Bebas Neue', Impact, sans-serif` para nombres, números y headings.
- `Georgia, 'Times New Roman', serif` para la quote.
- `'Geist', Georgia, serif` para todo lo demás.

Bebas Neue no está cargada en el proyecto. Se mantiene como nombre primero por si se carga en el futuro y como cue tipográfico explícito; el fallback `Impact` es el font realmente usado en captura — funciona en Win/macOS/iOS/Android, suficiente para el look editorial.

---

## Cambios por archivo

### Backend / data

**`lib/constants/movements.ts`** (✅ ya parcialmente hecho)

- Añadir `OLYMPIC_DISPLAY_MOVEMENTS` y `OLYMPIC_DISPLAY_LABEL` (ya hecho).
- Sin cambios al modelo de datos: las marcas siguen siendo `personal_records` con `movement` libre.

**`lib/actions/records.ts`** (✅ ya hecho)

- `getDiscoverableMembers` → `top_records` ahora es `OLYMPIC_DISPLAY_MOVEMENTS.map(...)` con peso 0 si falta. Sin filtro de "weight_kg > 0".
- `getMemberPublicProfile` → mismo cambio.
- Eliminado el import no usado `MOVEMENTS`.

**`lib/actions/portal.ts`** (pendiente)

- `getMyAthleteCardData` → cambiar `topRecords` para que devuelva los 3 levantamientos olímpicos en orden fijo, con peso 0 si falta. Sigue requiriendo al menos un record registrado en general (validación actual `records.length === 0` se mantiene como gate).
- Mantener el shape de `AthleteCardData.topRecords: Array<{ movement, label, weightKg }>` — solo cambia el contenido.
- En el `label` que devuelve esta función, usar `OLYMPIC_DISPLAY_LABEL[mv]` (devuelve "Jerk" para `split_jerk`).

### Front: ficha exportable

**`components/section-components/portal/perfil/AthleteCard.tsx`** (reescritura completa)

Portar Mockup B desde `components/section-components/portal/mockups/MockupEditorial.tsx`, con tres adaptaciones para data real:

1. Mantener el patrón de `position: fixed; left: -99999px; top: 0; pointer-events: none; z-index: -1` que sigue funcionando con la opción `style` del hook (ya parcheada).
2. Avatar usa `data.avatarUrl` cuando hay; si no, fallback a iniciales (igual que hoy).
3. Subtítulo: si `data.athleteLevel` está, mostrar `OLYMPIC_DISPLAY_LABEL`-style "RX · DESDE 2023". Si no hay nivel, fallback a "DESDE 2023" sin separador. Si no hay año tampoco, ocultar la línea.
4. Quote condicional (sigue como hoy: solo si `data.quote` existe).
5. Bloque "LEVANTAMIENTOS OLÍMPICOS": iterar `data.topRecords` (ya son los 3). Si todos pesan 0, **igual mostrar la sección con tres "—"** (no esconderla — la regla del backend es que llegamos aquí con al menos 1 record total, aunque podría no ser olímpico).
6. Grand Total (`data.totals.grand`): mantener — sigue sumando todos los records, no solo olímpicos.

Logo: `<img src="/Madbox_logo.jpeg" crossOrigin="anonymous" />` circular 110px con borde 2px dorado. Eliminar referencia al SVG anterior.

### Front: Descubrir

**`components/section-components/portal/descubrir/MemberCard.tsx`** (✅ ya hecho)

- Renderiza siempre 3 entradas usando `OLYMPIC_DISPLAY_LABEL[movement]`.
- Si `weight_kg === 0` muestra "—" en vez del peso.
- Estado vacío "Marcas privadas" / "Sin marcas registradas" se mantiene igual.

**`components/section-components/portal/descubrir/MemberDetailModal.tsx`** (✅ ya hecho)

- Añadida tira destacada "Levantamientos Olímpicos" justo después de `TotalsStrip` y antes del desglose por familia.
- 3 columnas, números grandes en dorado, "—" si peso es 0.
- El desglose por familia sigue mostrando Snatch / Clean & Jerk / Split Jerk en su contexto completo (para distinguir Push Jerk de Split Jerk).

### Cleanup

Después del port:

- Borrar `app/portal/mockups-ficha/page.tsx`.
- Borrar `components/section-components/portal/mockups/` completo (data + 3 mockups).
- Quitar el item "Mockups" del array `nav` en `app/portal/layout.tsx` y el icono `Palette` del import de `lucide-react`.

---

## Edge cases

1. **Miembro con records pero ninguno olímpico** — la sección "LEVANTAMIENTOS OLÍMPICOS" muestra los 3 labels con "—". Grand Total sigue sumando lo que tenga. Es un escenario válido (algún atleta puede tener Squat + Deadlift y nada de halterofilia).
2. **Miembro sin records** — ya gateado en `getMyAthleteCardData` con error "Registra al menos una marca…". El botón de compartir ya está disabled en este caso.
3. **Miembro con `show_rms = false` en Descubrir** — `getDiscoverableMembers` devuelve `top_records: []` y `totals: null`. La card muestra "Marcas privadas" como hoy.
4. **Miembro sin nivel de atleta (`athlete_level = null`)** — el subtítulo de la ficha cae a `DESDE [año]`. Si tampoco hay año, se omite la línea entera.
5. **Cambio de movimiento elegido a futuro** — todo el contrato vive en `OLYMPIC_DISPLAY_MOVEMENTS` + `OLYMPIC_DISPLAY_LABEL`. Cambiar `split_jerk` por `push_jerk`, o añadir un cuarto, es un solo edit en constants. No hace falta migración de datos.
6. **Captura en navegadores viejos** — ya cubierto por el fix en `useShareAthleteCard`: hex en vez de oklch, `style` override en `toBlob`, `await document.fonts.ready`, `crossOrigin="anonymous"` en imágenes.
7. **Logo en Cloudinary o CDN externa** — N/A, `Madbox_logo.jpeg` está en `public/`, mismo origen, sin riesgo de CORS.

---

## Re-validación e invalidaciones

`getMyAthleteCardData` no muta nada, no requiere `revalidatePath`. Sigue siendo una pure read.

Cambio en `top_records` en `getDiscoverableMembers`/`getMemberPublicProfile`: las queryKeys existentes siguen sirviendo (`['discoverable-members', gender]`, `['member-public', memberId]`). Cualquier mutación de `personal_records` (vía `upsertRecord` / `deleteRecord`) ya invalida `revalidatePath('/portal/descubrir')` — no hace falta tocar más.

---

## Plan de testing manual

1. **Generación de ficha** — atleta con todos los records olímpicos: ver que la ficha muestra los 3 valores en dorado, el oso arriba, "RX · DESDE 2023" en el subtítulo, stats en 3 columnas, Grand Total al pie. Compartir y verificar el PNG en visor externo.
2. **Sin records olímpicos** — atleta con solo Back Squat y Deadlift: la ficha muestra la sección "LEVANTAMIENTOS OLÍMPICOS" con tres "—" pero sí muestra el Grand Total con la suma del squat+deadlift.
3. **Sin athlete_level** — quitar el nivel en perfil: la ficha muestra "DESDE 2023" sin "RX". Quitar también athlete_since: la línea entera desaparece.
4. **Captura en iOS Safari real** — verificar que la imagen no es negra (regression del bug previo).
5. **Descubrir cards** — abrir tab Hombres y Mujeres, verificar que cada card muestra Snatch / Clean & Jerk / Jerk en orden (con "—" donde no haya). Buscar un miembro sin halterofilia → tres "—" pero la card no se rompe.
6. **Modal de descubrir** — clic en una card, ver tira "Levantamientos Olímpicos" con números grandes en dorado, y abajo el desglose por familia donde Snatch sigue en Halterofilia y Split Jerk en Presses & Jerks.
7. **Privacidad** — un atleta con `show_rms = false`: en Descubrir su card muestra "Marcas privadas", en el modal el bloque entero de records no aparece (incluyendo la nueva tira).
8. **Cleanup** — `/portal/mockups-ficha` debe responder 404 después del cleanup; ningún archivo en `components/section-components/portal/mockups/` debe quedar.

---

## Riesgos

- **Cambio semántico de `top_records`** — si en el futuro alguien añade un consumidor que asume "top por peso", verá los 3 olímpicos. Mitigación: comentario explícito en `records.ts` + nombre del array sigue describiendo "destacados", no "top por peso".
- **`Madbox_logo.jpeg` 500x500** — al renderizarse a 110px circular con borde dorado, debe quedar nítido en captura. Se confirmará en el primer test real (paso 1 del plan de testing).
- **Bebas Neue no cargada** — fallback a Impact. Ya está aceptado en el spec original. No cambia con este rediseño.
- **Olvidar borrar la pestaña Mockups** — incluir el cleanup como tarea explícita y testeable en el plan de implementación, no como note al pie.
