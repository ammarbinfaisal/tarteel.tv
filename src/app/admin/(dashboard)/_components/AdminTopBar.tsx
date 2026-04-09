import { Badge } from "@/components/ui/badge";
import AdminLogoutButton from "./AdminLogoutButton.client";
import AdminMobileNav from "./AdminMobileNav.client";

export default function AdminTopBar() {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/40 bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <AdminMobileNav />

      <div className="hidden items-center gap-2 lg:flex">
        <span className="text-sm font-semibold tracking-tight">tarteel.tv</span>
        <span className="text-xs text-muted-foreground">admin</span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <Badge variant="secondary" className="text-xs">
          Admin
        </Badge>
        <AdminLogoutButton />
      </div>
    </header>
  );
}
