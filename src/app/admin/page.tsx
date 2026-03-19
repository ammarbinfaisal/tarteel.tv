import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireAdminPageAuth } from "@/lib/server/admin-auth";

import AdminLogoutButton from "./AdminLogoutButton.client";

export const metadata = {
  title: "Admin",
};

export default async function AdminHomePage() {
  await requireAdminPageAuth("/admin");

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <p className="text-sm uppercase tracking-[0.25em] text-muted-foreground">Admin</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Clip operations</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Manage ingestion and clip metadata from a single place.
          </p>
        </div>

        <AdminLogoutButton />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/60 bg-card/70 backdrop-blur">
          <CardHeader>
            <CardTitle>Ingest</CardTitle>
            <CardDescription>Upload a new clip, optionally to Telegram and YouTube.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/admin/ingest">Open ingest form</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/70 backdrop-blur">
          <CardHeader>
            <CardTitle>Clip manager</CardTitle>
            <CardDescription>Edit clip metadata and review linked uploads.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="secondary">
              <Link href="/admin/clips">Open clip manager</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
