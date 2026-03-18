"use client"

import * as React from "react"
import { LayoutGrid, Film } from "lucide-react"

import { cn } from "@/lib/utils"
import { useHomeUiState } from "@/components/HomeUiState.client"

export function ViewModeToggle() {
  const { state, setView } = useHomeUiState()
  const view = state.view

  const handleSetView = (newView: "grid" | "reel") => {
    if (newView === view) return
    setView(newView)
  }

  return (
    <button
      type="button"
      className="relative flex h-10 w-[76px] items-center rounded-full bg-muted/50 p-1 select-none"
      onClick={() => handleSetView(view === "grid" ? "reel" : "grid")}
      aria-label={`Switch to ${view === "grid" ? "reel" : "grid"} view`}
    >
      <div
        className={cn(
          "absolute left-1 h-8 w-8 rounded-full bg-background shadow-md transition-transform duration-300 ease-in-out",
          view === "grid" ? "translate-x-0" : "translate-x-9"
        )}
      />

      <div className="relative z-10 flex w-full items-center justify-between">
        <div className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-200",
          view === "grid" ? "text-foreground" : "text-muted-foreground/60"
        )}>
          <LayoutGrid className="h-4 w-4" />
          <span className="sr-only">Grid View</span>
        </div>
        <div className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-200",
          view === "reel" ? "text-foreground" : "text-muted-foreground/60"
        )}>
          <Film className="h-4 w-4" />
          <span className="sr-only">Reel View</span>
        </div>
      </div>
    </button>
  )
}
