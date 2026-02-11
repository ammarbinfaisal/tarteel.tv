"use client"

import * as React from "react"
import { Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import ClipFilters from "./ClipFilters.client"
import type { HomeUiFilters } from "@/lib/home-ui-state"

type Props = {
  reciters: { slug: string; name: string }[];
  riwayat: string[];
  translations: string[];
  filters: HomeUiFilters;
  onApplyFilters: (next: HomeUiFilters) => void;
  onResetFilters: () => void;
};

export function FloatingFilters({
  reciters,
  riwayat,
  translations,
  filters,
  onApplyFilters,
  onResetFilters,
}: Props) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-40">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button data-testid="filters-open" size="icon" className="h-14 w-14 rounded-full shadow-lg">
            <Filter className="h-6 w-6" />
            <span className="sr-only">Filters</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[80vh] sm:max-w-md sm:h-full sm:side-right">
          <SheetHeader className="mb-4">
            <SheetTitle>Filters</SheetTitle>
          </SheetHeader>
          <div className="overflow-y-auto h-full pb-10">
            <ClipFilters 
              reciters={reciters} 
              riwayat={riwayat} 
              translations={translations}
              value={filters}
              onApplyFilters={onApplyFilters}
              onResetFilters={onResetFilters}
              onApply={() => setOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
