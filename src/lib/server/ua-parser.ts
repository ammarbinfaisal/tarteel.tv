/**
 * Lightweight User-Agent parser — extracts device type, browser, and OS.
 * No external dependencies; covers the top browsers/OSes that make up ~98% of traffic.
 */

export type ParsedUA = {
  deviceType: "desktop" | "mobile" | "tablet" | "bot";
  browser: string | null;
  os: string | null;
};

const BOT_RE = /bot|spider|crawl|slurp|mediapartners|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|googlebot|bingbot|yandex|baidu|duckduck|semrush|ahrefs|bytespider/i;

export function parseUserAgent(ua: string | null | undefined): ParsedUA {
  if (!ua) return { deviceType: "desktop", browser: null, os: null };

  if (BOT_RE.test(ua)) return { deviceType: "bot", browser: null, os: null };

  // --- Device type ---
  const isTablet = /iPad|tablet|playbook|silk/i.test(ua) && !/mobile/i.test(ua);
  const isMobile = /Mobile|Android.*Mobile|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Opera Mobi/i.test(ua);
  const deviceType = isTablet ? "tablet" : isMobile ? "mobile" : "desktop";

  // --- Browser (order matters: check specific before generic) ---
  let browser: string | null = null;
  if (/SamsungBrowser/i.test(ua)) browser = "Samsung Internet";
  else if (/OPR|Opera/i.test(ua)) browser = "Opera";
  else if (/Edg/i.test(ua)) browser = "Edge";
  else if (/Firefox|FxiOS/i.test(ua)) browser = "Firefox";
  else if (/CriOS/i.test(ua)) browser = "Chrome"; // Chrome on iOS
  else if (/Chrome/i.test(ua) && !/Chromium/i.test(ua)) browser = "Chrome";
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";

  // --- OS ---
  let os: string | null = null;
  if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Mac OS X|macOS/i.test(ua)) os = "macOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Windows/i.test(ua)) os = "Windows";
  else if (/Linux/i.test(ua)) os = "Linux";
  else if (/CrOS/i.test(ua)) os = "ChromeOS";

  return { deviceType, browser, os };
}
