"use client"

import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { toast } from "sonner"
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Eye, Pencil } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar } from "@/components/ui/calendar"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { getPlans } from "@/lib/actions/plans"
import {
  checkRoutineConflicts,
  createRoutineSchedule,
  updateRoutineSchedule,
  type RoutineSchedule,
} from "@/lib/actions/routines"
import { type ScoreSlot } from "@/lib/constants/score-slots"
import { scoreSlotsSchema } from "@/lib/schemas/score-slots"
import { ScoreSlotsManager } from "../ScoreSlotsManager"

const schema = z.object({
  date: z.string().min(1, "Selecciona una fecha"),
  plan_ids: z.array(z.string().uuid()).min(1, "Selecciona al menos un plan"),
  name: z.string().max(100, "Máx. 100 caracteres").optional(),
  content: z.string(),
  score_slots: scoreSlotsSchema,
})
type FormValues = z.infer<typeof schema>

type Mode = "create" | "edit"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  mode: Mode
  routine?: RoutineSchedule
}

export function RoutineWizardModal({ open, onOpenChange, mode, routine }: Props) {
  const queryClient = useQueryClient()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [conflictPlanIds, setConflictPlanIds] = useState<string[]>([])
  const [allowReplace, setAllowReplace] = useState(false)

  const todayISO = useMemo(() => {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Caracas",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    return fmt.format(new Date())
  }, [])

  const initialSlots = useMemo<ScoreSlot[]>(
    () => (routine?.score_slots ?? []),
    [routine],
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: routine?.date ?? todayISO,
      plan_ids: routine?.plans.map((p) => p.id) ?? [],
      name: routine?.name ?? "",
      content: routine?.content ?? "",
      score_slots: initialSlots,
    },
  })

  useEffect(() => {
    if (open) {
      form.reset({
        date: routine?.date ?? todayISO,
        plan_ids: routine?.plans.map((p) => p.id) ?? [],
        name: routine?.name ?? "",
        content: routine?.content ?? "",
        score_slots: initialSlots,
      })
      setStep(1)
      setConflictPlanIds([])
      setAllowReplace(false)
    }
  }, [open, routine, todayISO, form, initialSlots])

  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ["plans"],
    queryFn: getPlans,
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activePlans = (plans as any[]).filter((p) => p.active !== false)

  const date = form.watch("date")
  const planIds = form.watch("plan_ids")
  const content = form.watch("content")
  const score_slots = form.watch("score_slots")

  const checkConflictsMut = useMutation({
    mutationFn: (vars: { date: string; plan_ids: string[]; exclude_id?: string }) =>
      checkRoutineConflicts(vars),
    onSuccess: (conflicts) => {
      setConflictPlanIds(conflicts)
      if (conflicts.length === 0) {
        setAllowReplace(false)
        setStep(3)
      }
    },
    onError: (e: Error) => toast.error(e.message ?? "Error al validar"),
  })

  const handleNextFromPlans = () => {
    setConflictPlanIds([])
    setAllowReplace(false)
    checkConflictsMut.mutate({
      date,
      plan_ids: planIds,
      exclude_id: mode === "edit" ? routine?.id : undefined,
    })
  }

  const handleConfirmReplace = () => {
    setAllowReplace(true)
    setStep(3)
  }

  const submitMut = useMutation({
    mutationFn: async (values: FormValues) => {
      if (mode === "create") {
        return createRoutineSchedule({
          date: values.date,
          name: values.name?.trim() || null,
          content: values.content,
          score_slots: values.score_slots,
          plan_ids: values.plan_ids,
          replace_conflicts: allowReplace,
        })
      } else {
        if (!routine) throw new Error("Rutina no encontrada")
        return updateRoutineSchedule(routine.id, {
          date: values.date,
          name: values.name?.trim() || null,
          content: values.content,
          score_slots: values.score_slots,
          plan_ids: values.plan_ids,
          replace_conflicts: allowReplace,
        })
      }
    },
    onSuccess: () => {
      toast.success(mode === "create" ? "Rutina programada" : "Rutina actualizada")
      queryClient.invalidateQueries({ queryKey: ["routine-schedules"] })
      onOpenChange(false)
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (e: any) => {
      if (e?.code === "CONFLICT" && Array.isArray(e?.planIds)) {
        setConflictPlanIds(e.planIds)
        setAllowReplace(false)
        setStep(2)
        toast.error("Hay rutinas en conflicto para esa fecha")
      } else {
        toast.error(e?.message ?? "Error al guardar")
      }
    },
  })

  const onSubmit = form.handleSubmit((values) => submitMut.mutate(values))

  const stepValid =
    (step === 1 && !!date && (mode === "edit" || date >= todayISO)) ||
    (step === 2 && planIds.length > 0) ||
    (step === 3 &&
      (!!content?.trim() || (score_slots ?? []).length > 0))

  const titleByMode = mode === "create" ? "Programar nueva rutina" : "Editar rutina"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titleByMode}</DialogTitle>
          <DialogDescription>
            Paso {step} de 3 — {step === 1 ? "Fecha" : step === 2 ? "Planes" : "Contenido"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 px-1 py-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div
                className={cn(
                  "h-8 w-8 rounded-full border flex items-center justify-center text-sm font-medium",
                  step === s
                    ? "border-primary bg-primary text-primary-foreground"
                    : step > s
                      ? "border-primary bg-primary/20 text-primary"
                      : "border-muted text-muted-foreground",
                )}
              >
                {step > s ? <Check className="h-4 w-4" /> : s}
              </div>
              {s < 3 && (
                <div className={cn("h-px flex-1", step > s ? "bg-primary" : "bg-muted")} />
              )}
            </div>
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-3">
            <Label>Fecha de la rutina</Label>
            <div className="rounded-lg border p-3 flex justify-center">
              <Calendar
                mode="single"
                locale={es}
                selected={date ? parseISO(date + "T00:00:00") : undefined}
                onSelect={(d) => {
                  if (!d) return
                  const fmt = new Intl.DateTimeFormat("en-CA", {
                    timeZone: "America/Caracas",
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                  })
                  form.setValue("date", fmt.format(d), { shouldValidate: true })
                }}
                disabled={(d) => {
                  if (mode === "edit") return false
                  const fmt = new Intl.DateTimeFormat("en-CA", {
                    timeZone: "America/Caracas",
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                  })
                  return fmt.format(d) < todayISO
                }}
              />
            </div>
            {date && (
              <p className="text-sm text-muted-foreground">
                {(() => {
                  const label = format(parseISO(date + "T00:00:00"), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })
                  return label.charAt(0).toUpperCase() + label.slice(1)
                })()}
              </p>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <Label>Planes a los que aplica esta rutina</Label>
            {plansLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : activePlans.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay planes activos.</p>
            ) : (
              <ul className="space-y-2">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {activePlans.map((p: any) => {
                  const checked = planIds.includes(p.id)
                  const conflicted = conflictPlanIds.includes(p.id)
                  return (
                    <li
                      key={p.id}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border p-3",
                        conflicted && "border-amber-500/50 bg-amber-500/5",
                      )}
                    >
                      <Checkbox
                        id={`plan-${p.id}`}
                        checked={checked}
                        onCheckedChange={(v) => {
                          const next = v
                            ? [...planIds, p.id]
                            : planIds.filter((x) => x !== p.id)
                          form.setValue("plan_ids", next, { shouldValidate: true })
                          setConflictPlanIds([])
                          setAllowReplace(false)
                        }}
                      />
                      <Label htmlFor={`plan-${p.id}`} className="flex-1 cursor-pointer font-normal">
                        {p.name}
                      </Label>
                      {conflicted && (
                        <span className="text-xs text-amber-600 dark:text-amber-400">
                          Ya tiene rutina ese día
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

            {conflictPlanIds.length > 0 && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                  <div className="text-sm space-y-1">
                    <p className="font-medium">Conflicto detectado</p>
                    <p className="text-muted-foreground">
                      Los planes marcados ya tienen rutina programada para esa fecha.
                      Si continúas se reemplazará la rutina existente.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="destructive" onClick={handleConfirmReplace}>
                    Reemplazar y continuar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setConflictPlanIds([])}>
                    Cambiar selección
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="routine-name">Nombre (opcional)</Label>
              <Input
                id="routine-name"
                placeholder='Ej: "Murph" prep'
                value={form.watch("name") ?? ""}
                onChange={(e) => form.setValue("name", e.target.value)}
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label>Contenido (Markdown)</Label>
              <Tabs defaultValue="editor">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="editor" className="gap-1.5">
                    <Pencil className="h-3.5 w-3.5" /> Editor
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="gap-1.5">
                    <Eye className="h-3.5 w-3.5" /> Preview
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="editor">
                  <Textarea
                    placeholder={"# AMRAP 20'\n- 10 pull-ups\n- 20 push-ups\n- 30 air squats"}
                    value={content ?? ""}
                    onChange={(e) => form.setValue("content", e.target.value, { shouldValidate: true })}
                    rows={10}
                    className="font-mono text-sm"
                  />
                </TabsContent>
                <TabsContent value="preview">
                  <div className="rounded-md border border-border bg-card/40 p-3 min-h-48 prose prose-invert prose-sm max-w-none">
                    {content?.trim() ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Sin contenido. Empieza a escribir en la pestaña Editor.</p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            <ScoreSlotsManager
              slots={score_slots ?? []}
              onChange={(next) => form.setValue("score_slots", next, { shouldValidate: true })}
            />

            {form.formState.errors.score_slots && (
              <p className="text-xs text-destructive">
                {form.formState.errors.score_slots.message ??
                  (Array.isArray(form.formState.errors.score_slots)
                    ? "Hay slots con campos inválidos"
                    : "Slots inválidos")}
              </p>
            )}

            {!stepValid && (
              <p className="text-xs text-muted-foreground">
                Agrega al menos contenido en Markdown o un slot de score.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {step > 1 && (
            <Button variant="ghost" onClick={() => setStep((s) => (s === 3 ? 2 : 1) as 1 | 2 | 3)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Atrás
            </Button>
          )}
          {step === 1 && (
            <Button onClick={() => setStep(2)} disabled={!stepValid}>
              Siguiente <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {step === 2 && conflictPlanIds.length === 0 && (
            <Button
              onClick={handleNextFromPlans}
              disabled={!stepValid || checkConflictsMut.isPending}
            >
              {checkConflictsMut.isPending ? "Validando…" : "Siguiente"}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {step === 3 && (
            <Button onClick={onSubmit} disabled={!stepValid || submitMut.isPending}>
              {submitMut.isPending ? "Guardando…" : mode === "create" ? "Crear rutina" : "Guardar cambios"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
