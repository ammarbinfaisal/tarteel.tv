import { NextRequest, NextResponse } from "next/server";

import {
  ADMIN_SESSION_COOKIE_NAME,
  createAdminSessionToken,
  getAdminSessionCookieOptions,
  isAdminCredentialsValid,
} from "@/lib/server/admin-session";

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const username = readString(body.username);
  const password = readString(body.password);

  if (!isAdminCredentialsValid(username, password)) {
    return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  const cookieOptions = getAdminSessionCookieOptions(request.headers.get("host"));

  response.cookies.set(ADMIN_SESSION_COOKIE_NAME, createAdminSessionToken(), cookieOptions);

  return response;
}

export async function DELETE(request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  const cookieOptions = getAdminSessionCookieOptions(request.headers.get("host"));

  response.cookies.set(ADMIN_SESSION_COOKIE_NAME, "", {
    ...cookieOptions,
    maxAge: 0,
  });

  return response;
}
