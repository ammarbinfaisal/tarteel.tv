import crypto from "node:crypto";

export const ADMIN_SESSION_COOKIE_NAME = "tarteel_admin_session";
const ADMIN_SESSION_VERSION = "v1";
const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

type HeaderBag = {
  get(name: string): string | null;
};

function base64Url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function hmac(value: string): string {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD;
  if (!secret) {
    throw new Error("ADMIN_SESSION_SECRET or ADMIN_PASSWORD must be set");
  }

  return base64Url(crypto.createHmac("sha256", secret).update(value).digest());
}

function parseToken(token: string) {
  const [version, expiresAtRaw, signature] = token.split(".");
  const expiresAt = Number.parseInt(expiresAtRaw || "", 10);

  if (
    version !== ADMIN_SESSION_VERSION ||
    !Number.isFinite(expiresAt) ||
    !signature
  ) {
    return null;
  }

  return { version, expiresAt, signature };
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function isAdminCredentialsValid(username: string, password: string): boolean {
  return Boolean(
    process.env.ADMIN_USERNAME &&
    process.env.ADMIN_PASSWORD &&
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD,
  );
}

export function createAdminSessionToken(now = Date.now()): string {
  const expiresAt = Math.floor(now / 1000) + ADMIN_SESSION_TTL_SECONDS;
  const payload = `${ADMIN_SESSION_VERSION}.${expiresAt}`;
  return `${payload}.${hmac(payload)}`;
}

export function verifyAdminSessionToken(token: string | null | undefined, now = Date.now()): boolean {
  if (!token) {
    return false;
  }

  const parsed = parseToken(token);
  if (!parsed) {
    return false;
  }

  const payload = `${parsed.version}.${parsed.expiresAt}`;
  if (!safeEqual(parsed.signature, hmac(payload))) {
    return false;
  }

  return parsed.expiresAt >= Math.floor(now / 1000);
}

export function readCookieValue(cookieHeader: string | null | undefined, name: string): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }

  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey !== name) {
      continue;
    }

    return decodeURIComponent(rest.join("="));
  }

  return undefined;
}

export function getAdminSessionCookieDomain(hostname: string | null | undefined): string | undefined {
  if (!hostname) {
    return undefined;
  }

  const normalized = hostname.split(":")[0].toLowerCase();

  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "127.0.0.1" ||
    normalized === "::1"
  ) {
    return undefined;
  }

  if (normalized === "tarteel.tv" || normalized.endsWith(".tarteel.tv")) {
    return ".tarteel.tv";
  }

  return undefined;
}

export function getAdminSessionCookieOptions(hostname: string | null | undefined) {
  const normalized = hostname?.split(":")[0].toLowerCase();

  return {
    name: ADMIN_SESSION_COOKIE_NAME,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: normalized !== "localhost" && normalized !== "127.0.0.1" && normalized !== "::1",
    path: "/",
    maxAge: ADMIN_SESSION_TTL_SECONDS,
    domain: getAdminSessionCookieDomain(hostname),
  };
}

export function readAdminSessionToken(headers: HeaderBag | Headers): string | undefined {
  return readCookieValue(headers.get("cookie"), ADMIN_SESSION_COOKIE_NAME);
}

export function readBasicCredentials(headers: HeaderBag | Headers): { username: string; password: string } | null {
  const authHeader = headers.get("authorization");
  if (!authHeader?.startsWith("Basic ")) {
    return null;
  }

  const base64 = authHeader.slice("Basic ".length).trim();
  if (!base64) {
    return null;
  }

  const decoded = Buffer.from(base64, "base64").toString();
  const separator = decoded.indexOf(":");
  if (separator === -1) {
    return null;
  }

  return {
    username: decoded.slice(0, separator),
    password: decoded.slice(separator + 1),
  };
}

export function isAdminRequestAuthenticated(headers: HeaderBag | Headers): boolean {
  if (verifyAdminSessionToken(readAdminSessionToken(headers))) {
    return true;
  }

  const basic = readBasicCredentials(headers);
  if (!basic) {
    return false;
  }

  return isAdminCredentialsValid(basic.username, basic.password);
}
