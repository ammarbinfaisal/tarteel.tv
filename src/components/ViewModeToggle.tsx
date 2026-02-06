"use client"

import * as React from "react"
import { LayoutGrid, Film } from "lucide-react"
import { useQueryStates } from "nuqs"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { searchParamsParsers } from "@/lib/searchparams"

export function ViewModeToggle() {
  const [{ view }, setQuery] = useQueryStates({
    view: searchParamsParsers.view,
    clipId: searchParamsParsers.clipId,
  })

  const setView = (newView: "grid" | "reel") => {
    if (newView === view) return
    setQuery(
      {
        view: newView,
        ...(newView === "grid" ? { clipId: null } : {}),
      },
      { history: "push", shallow: false, scroll: true }
    )
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
