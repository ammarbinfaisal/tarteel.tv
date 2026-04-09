/**
 * Generate a privacy-safe visitor hash from IP + User-Agent + daily rotating salt.
 * Returns 16 hex chars — enough for unique-visitor counting, not enough to fingerprint.
 * The salt rotates daily so visitors cannot be correlated across days.
 *
 * Uses the Web Crypto API so it works in both Node.js and Edge runtimes.
 */
export async function generateVisitorHash(ip: string, userAgent: string): Promise<string> {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || "tarteel-analytics-salt";
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const input = `${ip}|${userAgent}|${secret}|${today}`;
  const encoded = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray.slice(0, 8))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
