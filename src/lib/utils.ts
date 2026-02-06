import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isProbablyMp4(urlOrKey: string | null | undefined) {
  if (!urlOrKey) return false;
  try {
    const u = new URL(urlOrKey);
    return u.pathname.toLowerCase().endsWith(".mp4");
  } catch {
    return urlOrKey.toLowerCase().split("?")[0].endsWith(".mp4");
  }
}

export const translationMap: Record<string, string> = {
  "saheeh-international": "Saheeh International",
  "khan-al-hilali": "Khan & al-Hilali",
};

export function formatTranslation(slug: string | undefined): string {
  if (!slug) return "";
  return translationMap[slug] || formatSlug(slug);
}

export function formatSlug(slug: string | undefined): string {
  if (!slug) return "";
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

