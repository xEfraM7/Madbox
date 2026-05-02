"use client"

import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { BLOCK_META, BLOCK_TYPE_ORDER, type BlockType } from "@/lib/constants/routine-blocks"

interface BlockPickerProps {
  onPick: (type: BlockType) => void
  disabled?: boolean
}

export function BlockPicker({ onPick, disabled }: BlockPickerProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={disabled} className="gap-2 w-full sm:w-auto">
          <Plus className="h-4 w-4" /> Agregar bloque
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {BLOCK_TYPE_ORDER.map((t) => {
          const meta = BLOCK_META[t]
          const Icon = meta.icon
          return (
            <DropdownMenuItem key={t} onClick={() => onPick(t)} className="gap-2">
              <Icon className="h-4 w-4 text-primary" />
              <span>{meta.label}</span>
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
