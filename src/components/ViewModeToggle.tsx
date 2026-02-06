"use client"

import * as React from "react"
import { LayoutGrid, Film } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ViewModeToggle() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const view = searchParams.get("view") === "reel" ? "reel" : "grid"

  const setView = (newView: "grid" | "reel") => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("view", newView)
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-1 bg-muted p-1 rounded-md">
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "h-8 w-8 p-0",
          view === "grid" && "bg-background shadow-sm"
        )}
        onClick={() => setView("grid")}
      >
        <LayoutGrid className="h-4 w-4" />
        <span className="sr-only">Grid View</span>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "h-8 w-8 p-0",
          view === "reel" && "bg-background shadow-sm"
        )}
        onClick={() => setView("reel")}
      >
        <Film className="h-4 w-4" />
        <span className="sr-only">Reel View</span>
      </Button>
    </div>
  )
}
