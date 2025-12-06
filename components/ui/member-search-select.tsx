"use client"

import { useState, useMemo } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface Member {
  id: string
  name: string
  email?: string
}

interface MemberSearchSelectProps {
  members: Member[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
}

export function MemberSearchSelect({ members, value, onValueChange, placeholder = "Selecciona un cliente" }: MemberSearchSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  const filteredMembers = useMemo(() => {
    if (!search) return members
    const searchLower = search.toLowerCase()
    return members.filter(
      (member) => member.name.toLowerCase().includes(searchLower) || member.email?.toLowerCase().includes(searchLower)
    )
  }, [members, search])

  const selectedMember = members.find((m) => m.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          {selectedMember ? selectedMember.name : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Buscar cliente..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>No se encontraron clientes</CommandEmpty>
            <CommandGroup>
              {filteredMembers.map((member) => (
                <CommandItem
                  key={member.id}
                  value={member.id}
                  onSelect={() => {
                    onValueChange(member.id)
                    setOpen(false)
                    setSearch("")
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === member.id ? "opacity-100" : "opacity-0")} />
                  <div>
                    <p>{member.name}</p>
                    {member.email && <p className="text-xs text-muted-foreground">{member.email}</p>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
