"use client"

import { Textarea } from "@/components/ui/textarea"
import type {
  WarmupBlock,
  CooldownBlock,
  NotesBlock,
} from "@/lib/constants/routine-blocks"

type TextBlock = WarmupBlock | CooldownBlock | NotesBlock

interface Props {
  block: TextBlock
  placeholder: string
  onChange: (next: TextBlock) => void
}

export function TextBlockEditor({ block, placeholder, onChange }: Props) {
  return (
    <Textarea
      placeholder={placeholder}
      value={block.text}
      onChange={(e) => onChange({ ...block, text: e.target.value })}
      rows={3}
      className="font-mono text-sm"
    />
  )
}
