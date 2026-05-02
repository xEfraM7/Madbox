"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Plus, Trash2 } from "lucide-react"
import type { RoutineBlock } from "@/lib/constants/routine-blocks"

// ─── Helpers ─────────────────────────────────────────────

function MovementsEditor({
  values,
  onChange,
  placeholder,
}: {
  values: string[]
  onChange: (next: string[]) => void
  placeholder?: string
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Movimientos</Label>
      {values.map((v, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <Input
            value={v}
            placeholder={placeholder ?? "Ej: 10 burpees"}
            onChange={(e) => {
              const next = [...values]
              next[i] = e.target.value
              onChange(next)
            }}
            className="text-sm"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => {
              if (values.length === 1) {
                onChange([""])
              } else {
                onChange(values.filter((_, idx) => idx !== i))
              }
            }}
            className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onChange([...values, ""])}
        className="h-7 text-[11px] gap-1 text-muted-foreground"
      >
        <Plus className="h-3 w-3" /> Agregar movimiento
      </Button>
    </div>
  )
}

function NumberInput({
  id, label, value, onChange, min, placeholder,
}: {
  id: string
  label: string
  value: number
  onChange: (n: number) => void
  min?: number
  placeholder?: string
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={min ?? 0}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          const n = Number(e.target.value)
          onChange(Number.isFinite(n) && n >= 0 ? n : 0)
        }}
        className="text-sm"
      />
    </div>
  )
}

function FreeTextEditor({
  value, onChange, placeholder, rows = 3,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
}) {
  return (
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="text-sm"
    />
  )
}

// ─── Editor por tipo ─────────────────────────────────────

interface EditorProps<B extends RoutineBlock> {
  block: B
  onChange: (next: B) => void
}

function WarmupEditor({ block, onChange }: EditorProps<RoutineBlock & { type: "warmup" }>) {
  return <FreeTextEditor value={block.text} onChange={(text) => onChange({ ...block, text })} placeholder="Ej: Movilidad de hombros 5 min, 3 rondas de 10 jumping jacks…" />
}

function CooldownEditor({ block, onChange }: EditorProps<RoutineBlock & { type: "cooldown" }>) {
  return <FreeTextEditor value={block.text} onChange={(text) => onChange({ ...block, text })} placeholder="Ej: Estiramiento isquios 2 min, foam roller espalda…" />
}

function NotesEditor({ block, onChange }: EditorProps<RoutineBlock & { type: "notes" }>) {
  return <FreeTextEditor value={block.text} onChange={(text) => onChange({ ...block, text })} placeholder="Notas del coach…" rows={4} />
}

function StrengthEditor({ block, onChange }: EditorProps<RoutineBlock & { type: "strength" }>) {
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label htmlFor={`ex-${block.id}`} className="text-xs">Ejercicio</Label>
        <Input
          id={`ex-${block.id}`}
          value={block.exercise}
          onChange={(e) => onChange({ ...block, exercise: e.target.value })}
          placeholder="Ej: Back Squat"
          className="text-sm"
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <NumberInput id={`s-${block.id}`} label="Sets" value={block.sets} min={1} onChange={(sets) => onChange({ ...block, sets })} />
        <div className="space-y-1">
          <Label htmlFor={`r-${block.id}`} className="text-xs">Reps</Label>
          <Input id={`r-${block.id}`} value={block.reps} onChange={(e) => onChange({ ...block, reps: e.target.value })} placeholder="5 / 5-3-1 / AMRAP" className="text-sm" />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`w-${block.id}`} className="text-xs">Peso/% (opc)</Label>
          <Input id={`w-${block.id}`} value={block.weight ?? ""} onChange={(e) => onChange({ ...block, weight: e.target.value })} placeholder="80 kg / 70%" className="text-sm" />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`n-${block.id}`} className="text-xs">Notas (opc)</Label>
        <Input id={`n-${block.id}`} value={block.notes ?? ""} onChange={(e) => onChange({ ...block, notes: e.target.value })} placeholder="Foco en técnica…" className="text-sm" />
      </div>
    </div>
  )
}

function SkillEditor({ block, onChange }: EditorProps<RoutineBlock & { type: "skill" }>) {
  return (
    <div className="space-y-2">
      <MovementsEditor
        values={block.exercises}
        onChange={(exercises) => onChange({ ...block, exercises })}
        placeholder="Ej: Double under × 50"
      />
      <div className="space-y-1">
        <Label htmlFor={`sn-${block.id}`} className="text-xs">Notas (opc)</Label>
        <Input id={`sn-${block.id}`} value={block.notes ?? ""} onChange={(e) => onChange({ ...block, notes: e.target.value })} placeholder="Tempo, foco, etc." className="text-sm" />
      </div>
    </div>
  )
}

function AmrapEditor({ block, onChange }: EditorProps<RoutineBlock & { type: "amrap" }>) {
  return (
    <div className="space-y-2">
      <NumberInput id={`m-${block.id}`} label="Minutos" value={block.minutes} min={1} onChange={(minutes) => onChange({ ...block, minutes })} />
      <MovementsEditor values={block.movements} onChange={(movements) => onChange({ ...block, movements })} />
    </div>
  )
}

function EmomEditor({ block, onChange }: EditorProps<RoutineBlock & { type: "emom" }>) {
  return (
    <div className="space-y-2">
      <NumberInput id={`m-${block.id}`} label="Minutos totales" value={block.minutes} min={1} onChange={(minutes) => onChange({ ...block, minutes })} />
      <MovementsEditor values={block.movements} onChange={(movements) => onChange({ ...block, movements })} placeholder="Ej: Min 1 - 10 KB swings; Min 2 - 5 burpees" />
      <div className="flex items-center justify-between gap-2 rounded-md border border-border p-2">
        <Label htmlFor={`alt-${block.id}`} className="text-xs">Alternando minutos (impar/par)</Label>
        <Switch id={`alt-${block.id}`} checked={block.alternating} onCheckedChange={(alternating) => onChange({ ...block, alternating })} />
      </div>
    </div>
  )
}

function ForTimeEditor({ block, onChange }: EditorProps<RoutineBlock & { type: "for_time" }>) {
  return (
    <div className="space-y-2">
      <MovementsEditor values={block.movements} onChange={(movements) => onChange({ ...block, movements })} />
      <div className="space-y-1">
        <Label htmlFor={`cap-${block.id}`} className="text-xs">Time cap (min, opc)</Label>
        <Input
          id={`cap-${block.id}`}
          type="number"
          inputMode="numeric"
          min={1}
          value={block.time_cap_min ?? ""}
          placeholder="Ej: 20"
          onChange={(e) => {
            const v = e.target.value
            const n = v === "" ? undefined : Number(v)
            onChange({ ...block, time_cap_min: typeof n === "number" && Number.isFinite(n) && n > 0 ? n : undefined })
          }}
          className="text-sm"
        />
      </div>
    </div>
  )
}

function ForRepsEditor({ block, onChange }: EditorProps<RoutineBlock & { type: "for_reps" }>) {
  return (
    <div className="space-y-2">
      <NumberInput id={`tr-${block.id}`} label="Reps objetivo" value={block.target_reps} min={1} onChange={(target_reps) => onChange({ ...block, target_reps })} />
      <MovementsEditor values={block.movements} onChange={(movements) => onChange({ ...block, movements })} />
    </div>
  )
}

function RftEditor({ block, onChange }: EditorProps<RoutineBlock & { type: "rft" }>) {
  return (
    <div className="space-y-2">
      <NumberInput id={`r-${block.id}`} label="Rounds" value={block.rounds} min={1} onChange={(rounds) => onChange({ ...block, rounds })} />
      <MovementsEditor values={block.movements} onChange={(movements) => onChange({ ...block, movements })} />
    </div>
  )
}

// ─── Dispatcher ──────────────────────────────────────────

export function BlockEditor({
  block,
  onChange,
}: {
  block: RoutineBlock
  onChange: (next: RoutineBlock) => void
}) {
  switch (block.type) {
    case "warmup":   return <WarmupEditor block={block} onChange={onChange} />
    case "cooldown": return <CooldownEditor block={block} onChange={onChange} />
    case "notes":    return <NotesEditor block={block} onChange={onChange} />
    case "strength": return <StrengthEditor block={block} onChange={onChange} />
    case "skill":    return <SkillEditor block={block} onChange={onChange} />
    case "amrap":    return <AmrapEditor block={block} onChange={onChange} />
    case "emom":     return <EmomEditor block={block} onChange={onChange} />
    case "for_time": return <ForTimeEditor block={block} onChange={onChange} />
    case "for_reps": return <ForRepsEditor block={block} onChange={onChange} />
    case "rft":      return <RftEditor block={block} onChange={onChange} />
  }
}
