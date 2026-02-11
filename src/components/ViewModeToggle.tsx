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
    <div 
      className="relative flex items-center bg-muted/50 p-1 rounded-full w-[84px] h-[40px] cursor-pointer select-none"
      onClick={() => handleSetView(view === "grid" ? "reel" : "grid")}
    >
      <div
        className={cn(
          "absolute h-[32px] w-[32px] bg-background rounded-full shadow-md z-0 transition-transform duration-300 ease-in-out",
          view === "grid" ? "translate-x-0" : "translate-x-[44px]"
        )}
      />
      
      <div className="relative z-10 flex w-full justify-between items-center px-1.5">
        <div className={cn(
          "flex items-center justify-center w-[32px] h-[32px] rounded-full transition-colors duration-200",
          view === "grid" ? "text-foreground" : "text-muted-foreground/60"
        )}>
          <LayoutGrid className="h-4 w-4" />
          <span className="sr-only">Grid View</span>
        </div>
        <div className={cn(
          "flex items-center justify-center w-[32px] h-[32px] rounded-full transition-colors duration-200",
          view === "reel" ? "text-foreground" : "text-muted-foreground/60"
        )}>
          <Film className="h-4 w-4" />
          <span className="sr-only">Reel View</span>
        </div>
      </div>
    </div>
  )
}
