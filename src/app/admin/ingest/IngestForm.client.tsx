"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

interface IngestFormProps {
  reciters: { slug: string; name: string }[];
  riwayat: string[];
  translations: string[];
  endpoint: string;
  adminUser: string;
  adminPass: string;
}

export default function IngestForm({ reciters, riwayat, translations, endpoint, adminUser, adminPass }: IngestFormProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const formData = new FormData(e.currentTarget);
    
    try {
      const auth = btoa(`${adminUser}:${adminPass}`);
      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
        headers: {
          "Authorization": `Basic ${auth}`,
        }
      });

      const result = await response.json();
      
      if (result.success) {
        setMessage({ type: "success", text: `Successfully ingested: ${result.clipId}` });
        (e.target as HTMLFormElement).reset();
      } else {
        setMessage({ type: "error", text: result.error || "Unknown error occurred" });
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
        <form onSubmit={handleSubmit} className="space-y-6">
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

          {message && (
            <div className={`p-4 rounded-md ${message.type === 'success' ? 'bg-green-900/50 text-green-200' : 'bg-red-900/50 text-red-200'}`}>
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
