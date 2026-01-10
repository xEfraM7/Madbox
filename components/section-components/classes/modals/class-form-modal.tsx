"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { showToast } from "@/lib/sweetalert"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DateInput } from "@/components/ui/date-input"
import { TimeInput } from "@/components/ui/time-input"
import { Loader2 } from "lucide-react"
import { createSpecialClass, updateSpecialClass } from "@/lib/actions/classes"

interface ClassFormModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  classItem?: any
}

interface FormData {
  name: string
  instructor: string
  price: string
  capacity: string
  date: string
  startTime: string
  endTime: string
}

function parseSchedule(schedule: string): { date: string; startTime: string; endTime: string } {
  if (!schedule) return { date: "", startTime: "", endTime: "" }
  const match = schedule.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})$/)
  if (match) {
    return { date: match[1], startTime: match[2], endTime: match[3] }
  }
  return { date: "", startTime: "", endTime: "" }
}

export function ClassFormModal({ open, onOpenChange, classItem }: ClassFormModalProps) {
  const queryClient = useQueryClient()
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>({
    defaultValues: { name: "", instructor: "", price: "", capacity: "", date: "", startTime: "", endTime: "" }
  })

  useEffect(() => {
    if (open) {
      if (classItem) {
        const { date, startTime, endTime } = parseSchedule(classItem.schedule)
        reset({
          name: classItem.name || "",
          instructor: classItem.instructor || "",
          price: classItem.price?.toString() || "",
          capacity: classItem.capacity?.toString() || "",
          date,
          startTime,
          endTime
        })
      } else {
        reset({ name: "", instructor: "", price: "", capacity: "", date: "", startTime: "", endTime: "" })
      }
    }
  }, [classItem, open, reset])

  const createMutation = useMutation({
    mutationFn: (data: any) => createSpecialClass(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["special-classes"] })
      showToast.success("Clase creada", "La clase ha sido creada correctamente." )
      onOpenChange(false)
    },
    onError: () => {
      showToast.error("Error", "No se pudo crear la clase." )
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: any) => updateSpecialClass(classItem.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["special-classes"] })
      showToast.success("Clase actualizada", "Los cambios han sido guardados." )
      onOpenChange(false)
    },
    onError: () => {
      showToast.error("Error", "No se pudo actualizar la clase." )
    },
  })

  const onSubmit = (data: FormData) => {
    const schedule = `${data.date} ${data.startTime} - ${data.endTime}`
    const classData = {
      name: data.name,
      instructor: data.instructor,
      price: parseFloat(data.price),
      capacity: parseInt(data.capacity),
      schedule
    }

    if (classItem) {
      updateMutation.mutate(classData)
    } else {
      createMutation.mutate(classData)
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{classItem ? "Editar Clase" : "Crear Nueva Clase"}</DialogTitle>
          <DialogDescription>{classItem ? "Modifica los detalles de la clase" : "Define una nueva clase especial"}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nombre de la clase</Label>
              <Input id="name" {...register("name", { required: "El nombre es requerido" })} placeholder="Ej: Yoga Avanzado" />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="instructor">Instructor</Label>
              <Input id="instructor" {...register("instructor", { required: "El instructor es requerido" })} placeholder="Nombre del instructor" />
              {errors.instructor && <p className="text-sm text-destructive">{errors.instructor.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="price">Precio</Label>
                <Input id="price" type="number" step="0.01" {...register("price", { required: "El precio es requerido" })} placeholder="0.00" />
                {errors.price && <p className="text-sm text-destructive">{errors.price.message}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="capacity">Capacidad</Label>
                <Input id="capacity" type="number" {...register("capacity", { required: "La capacidad es requerida" })} placeholder="20" />
                {errors.capacity && <p className="text-sm text-destructive">{errors.capacity.message}</p>}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="date">Fecha</Label>
              <DateInput value={watch("date")} onChange={(value) => setValue("date", value)} />
              {errors.date && <p className="text-sm text-destructive">{errors.date.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startTime">Hora de inicio</Label>
                <TimeInput value={watch("startTime")} onChange={(value) => setValue("startTime", value)} placeholder="Inicio" />
                {errors.startTime && <p className="text-sm text-destructive">{errors.startTime.message}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="endTime">Hora de fin</Label>
                <TimeInput value={watch("endTime")} onChange={(value) => setValue("endTime", value)} placeholder="Fin" />
                {errors.endTime && <p className="text-sm text-destructive">{errors.endTime.message}</p>}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>Cancelar</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : classItem ? "Guardar cambios" : "Crear clase"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
