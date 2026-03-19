import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import {
  ADMIN_SESSION_COOKIE_NAME,
  isAdminRequestAuthenticated,
  verifyAdminSessionToken,
} from "@/lib/server/admin-session";

export function requireAdminAuth(request: Request): Response | null {
  if (isAdminRequestAuthenticated(request.headers)) {
    return null;
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function requireAdminPageAuth(nextPath: string): Promise<void> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;

  if (verifyAdminSessionToken(sessionToken)) {
    return;
  }

  redirect(`/admin/login?next=${encodeURIComponent(nextPath)}` as "/admin/login");
}

export async function redirectAuthenticatedAdmin(target = "/admin"): Promise<void> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;

  if (verifyAdminSessionToken(sessionToken)) {
    redirect(target as "/admin");
  }
}
