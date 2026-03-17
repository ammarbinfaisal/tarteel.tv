"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

interface IngestFormProps {
  reciters: { slug: string; name: string }[];
  riwayat: string[];
  translations: string[];
  authHeader: string;
  ingestEndpoint: string;
}

interface JobStatus {
  id: string;
  status: "uploading" | "processing" | "done" | "error";
  step: string;
  clipId?: string;
  telegram?: { status: string; error?: string };
  youtube?: { status: string; videoId?: string; error?: string };
}

export default function IngestForm({ reciters, riwayat, translations, authHeader, ingestEndpoint }: IngestFormProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const pollJob = useCallback(async (jobId: string) => {
    const statusUrl = `${ingestEndpoint}/status/${jobId}`;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const res = await fetch(statusUrl);
        if (!res.ok) throw new Error(`Status check failed (${res.status})`);
        const job: JobStatus = await res.json();

        if (job.status === "processing" || job.status === "uploading") {
          setMessage({ type: "info", text: job.step });
          continue;
        }

        if (job.status === "done") {
          let text = `Successfully ingested: ${job.clipId}`;
          if (job.telegram) text += `\nTelegram: ${job.telegram.status}${job.telegram.error ? ` — ${job.telegram.error}` : ""}`;
          if (job.youtube) text += `\nYouTube: ${job.youtube.status}${job.youtube.videoId ? ` (${job.youtube.videoId})` : ""}${job.youtube.error ? ` — ${job.youtube.error}` : ""}`;
          setMessage({ type: "success", text });
          formRef.current?.reset();
          return;
        }

        // error
        setMessage({ type: "error", text: job.step || "Ingestion failed" });
        return;
      } catch {
        // Network blip — keep polling
        continue;
      }
    }
  }, [ingestEndpoint]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: "info", text: "Uploading file..." });

    const formData = new FormData(e.currentTarget);

    try {
      const response = await fetch(ingestEndpoint, {
        method: "POST",
        headers: { Authorization: authHeader },
        body: formData,
      });

      const result = await response.json();

      if (result.jobId) {
        setMessage({ type: "info", text: "Processing..." });
        await pollJob(result.jobId);
      } else if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "error", text: "Unexpected response from server" });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to submit" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="surah">Surah Number</Label>
              <Input id="surah" name="surah" type="number" min="1" max="114" required defaultValue="1" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="ayahStart">Start</Label>
                <Input id="ayahStart" name="ayahStart" type="number" min="1" required defaultValue="1" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ayahEnd">End</Label>
                <Input id="ayahEnd" name="ayahEnd" type="number" min="1" required defaultValue="1" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reciterSlug">Reciter</Label>
            <Select name="reciterSlug" defaultValue={reciters[0]?.slug}>
              <SelectTrigger>
                <SelectValue placeholder="Select reciter" />
              </SelectTrigger>
              <SelectContent>
                {reciters.map((r) => (
                  <SelectItem key={r.slug} value={r.slug}>{r.name}</SelectItem>
                ))}
                <SelectItem value="custom">-- Custom Slug --</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="customReciterSlug">Custom Reciter Slug (if selected above)</Label>
            <Input id="customReciterSlug" name="customReciterSlug" placeholder="e.g. mishary-rashid" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reciterName">Reciter Name (for custom slug)</Label>
            <Input id="reciterName" name="reciterName" placeholder="e.g. Mishary Rashid Alafasy" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="riwayah">Riwayah</Label>
              <Select name="riwayah" defaultValue="hafs-an-asim">
                <SelectTrigger>
                  <SelectValue placeholder="Select riwayah" />
                </SelectTrigger>
                <SelectContent>
                  {riwayat.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                  {!riwayat.includes("hafs-an-asim") && (
                    <SelectItem value="hafs-an-asim">hafs-an-asim</SelectItem>
                  )}
                  <SelectItem value="custom">-- Custom --</SelectItem>
                </SelectContent>
              </Select>
              <Input name="customRiwayah" className="mt-2" placeholder="Custom riwayah slug" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="translation">Translation</Label>
              <Select name="translation" defaultValue="saheeh-international">
                <SelectTrigger>
                  <SelectValue placeholder="Select translation" />
                </SelectTrigger>
                <SelectContent>
                  {translations.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                  {!translations.includes("saheeh-international") && (
                    <SelectItem value="saheeh-international">saheeh-international</SelectItem>
                  )}
                  <SelectItem value="custom">-- Custom --</SelectItem>
                </SelectContent>
              </Select>
              <Input name="customTranslation" className="mt-2" placeholder="Custom translation slug" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="video">Video File</Label>
            <Input id="video" name="video" type="file" accept="video/*" required />
          </div>

          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" name="uploadTelegram" defaultChecked className="h-4 w-4 rounded border-gray-600" />
              Upload to Telegram
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" name="uploadYoutube" defaultChecked className="h-4 w-4 rounded border-gray-600" />
              Upload to YouTube
            </label>
          </div>

          {message && (
            <div className={`p-4 rounded-md whitespace-pre-line ${
              message.type === 'success' ? 'bg-green-900/50 text-green-200' :
              message.type === 'info' ? 'bg-blue-900/50 text-blue-200' :
              'bg-red-900/50 text-red-200'
            }`}>
              {message.type === 'info' && <span className="inline-block mr-2 animate-spin">&#9696;</span>}
              {message.text}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Ingesting..." : "Ingest Clip"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
