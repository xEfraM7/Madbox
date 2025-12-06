"use client"

import * as React from "react"
import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface TimeInputProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function TimeInput({ value, onChange, placeholder = "Hora", disabled, className }: TimeInputProps) {
  const [open, setOpen] = React.useState(false)

  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"))
  const minutes = ["00", "15", "30", "45"]

  const handleSelect = (hour: string, minute: string) => {
    if (onChange) {
      onChange(`${hour}:${minute}`)
    }
    setOpen(false)
  }

  const displayValue = value || placeholder

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn("w-full justify-start text-left font-normal", !value && "text-muted-foreground", className)}
        >
          <Clock className="mr-2 h-4 w-4 text-yellow-500" />
          {displayValue}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3 max-h-[300px] overflow-y-auto">
          <div className="grid grid-cols-4 gap-1">
            {hours.map((hour) =>
              minutes.map((minute) => {
                const timeValue = `${hour}:${minute}`
                const isSelected = value === timeValue
                return (
                  <Button
                    key={timeValue}
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-8 text-xs",
                      isSelected && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
                    )}
                    onClick={() => handleSelect(hour, minute)}
                  >
                    {timeValue}
                  </Button>
                )
              })
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
