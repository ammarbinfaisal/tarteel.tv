"use client"

import * as React from "react"
import { LayoutGrid, Film } from "lucide-react"
import { useQueryStates } from "nuqs"

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
    <div 
      className="relative flex items-center bg-muted/50 p-1 rounded-full w-[84px] h-[40px] cursor-pointer select-none"
      onClick={() => setView(view === "grid" ? "reel" : "grid")}
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
