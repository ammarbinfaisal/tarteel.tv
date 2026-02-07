import { ingestClip } from "../src/lib/server/ingestion";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const PORT = process.env.INGEST_PORT || 3001;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
  console.error("ADMIN_USERNAME and ADMIN_PASSWORD must be set");
  process.exit(1);
}

console.log(`Ingestion server starting on port ${PORT}...`);

Bun.serve({
  port: PORT,
  async fetch(req) {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Authorization, Content-Type",
        },
      });
    }

    const url = new URL(req.url);

    if (url.pathname === "/ingest" && req.method === "POST") {
      // Basic Auth Check
      const authHeader = req.headers.get("authorization");
      if (!authHeader) return new Response("Unauthorized", { status: 401 });
      
      const auth = authHeader.split(" ")[1];
      const [user, pwd] = Buffer.from(auth, "base64").toString().split(":");
      if (user !== ADMIN_USERNAME || pwd !== ADMIN_PASSWORD) {
        return new Response("Unauthorized", { status: 401 });
      }

      try {
        const formData = await req.formData();
        const video = formData.get("video");
        if (!video) throw new Error("No video file uploaded");

        const surah = parseInt(formData.get("surah"));
        const ayahStart = parseInt(formData.get("ayahStart"));
        const ayahEnd = parseInt(formData.get("ayahEnd"));
        let reciterSlug = formData.get("reciterSlug");
        let reciterName = formData.get("reciterName");
        if (reciterSlug === "custom") reciterSlug = formData.get("customReciterSlug");

        let riwayah = formData.get("riwayah");
        if (riwayah === "custom") riwayah = formData.get("customRiwayah");

        let translation = formData.get("translation");
        if (translation === "custom") translation = formData.get("customTranslation");

        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ingest-"));
        const videoPath = path.join(tempDir, video.name);
        
        await Bun.write(videoPath, video);

        const clipId = await ingestClip(videoPath, {
          surah,
          ayahStart,
          ayahEnd,
          reciterSlug,
          reciterName: reciterName || undefined,
          riwayah,
          translation,
        });

        await fs.rm(tempDir, { recursive: true, force: true });

        return new Response(JSON.stringify({ success: true, clipId }), {
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*" 
          },
        });
      } catch (err: any) {
        console.error("Ingestion error:", err);
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          },
        });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
});
