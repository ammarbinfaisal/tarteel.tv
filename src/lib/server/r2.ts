import "server-only";

import type { ClipVariant } from "@/lib/types";

function trimSlashes(s: string) {
  return s.replace(/^\/+/, "").replace(/\/+$/, "");
}

export function variantToPublicUrl(variant: ClipVariant): string | null {
  if (variant.url) return variant.url;
  const base = process.env.R2_PUBLIC_BASE_URL;
  if (!base) return null;
  return `${trimSlashes(base)}/${trimSlashes(variant.r2Key)}`;
}

