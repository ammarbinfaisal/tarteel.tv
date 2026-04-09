"use client";

import { useState } from "react";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import AdminSidebar from "./AdminSidebar";

export default function AdminMobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="size-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-60 p-0">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <div className="border-b border-border/40 px-4 py-3">
          <span className="text-sm font-semibold tracking-tight">tarteel.tv</span>
          <span className="ml-1 text-xs text-muted-foreground">admin</span>
        </div>
        {/* Close the sheet when a nav link is clicked */}
        <div onClick={() => setOpen(false)}>
          <AdminSidebar className="px-2" />
        </div>
      </SheetContent>
    </Sheet>
  );
}
