import { requireAdminPageAuth } from "@/lib/server/admin-auth";
import AdminSidebar from "./_components/AdminSidebar";
import AdminTopBar from "./_components/AdminTopBar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPageAuth("/admin");

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-border/40 bg-card/30 lg:block">
        <div className="sticky top-0 flex h-screen flex-col overflow-y-auto">
          <AdminSidebar className="flex-1 px-2 pt-4" />
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        <AdminTopBar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
