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

type Props = {
  reciters: { slug: string; name: string }[];
  riwayat: string[];
  translations: string[];
};

export function FloatingFilters({ reciters, riwayat, translations }: Props) {
  return (
    <div className="fixed bottom-6 right-6 z-40">
      <Sheet>
        <SheetTrigger asChild>
          <Button size="icon" className="h-14 w-14 rounded-full shadow-lg">
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
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
