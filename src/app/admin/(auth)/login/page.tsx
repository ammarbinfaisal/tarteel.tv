import { redirectAuthenticatedAdmin } from "@/lib/server/admin-auth";

import LoginForm from "./LoginForm.client";

export const metadata = {
  title: "Login",
};

export default async function AdminLoginPage() {
  await redirectAuthenticatedAdmin();

  return (
    <div className="grid w-full max-w-5xl gap-10 lg:grid-cols-[1.1fr_420px] lg:items-center">
      <div className="space-y-4">
        <p className="text-sm uppercase tracking-[0.25em] text-muted-foreground">Tarteel Admin</p>
        <h1 className="max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Sign in once, manage clips without re-entering credentials.
        </h1>
        <p className="max-w-lg text-sm text-muted-foreground">
          The admin session now covers metadata editing, Telegram tracking, and ingest requests.
        </p>
      </div>

      <LoginForm />
    </div>
  );
}
