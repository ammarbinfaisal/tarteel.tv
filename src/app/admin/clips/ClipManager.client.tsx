"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, ExternalLink, RefreshCcw, Search, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn, formatSlug, formatTranslation, surahNames } from "@/lib/utils";
import type { Clip } from "@/lib/types";

type AdminClip = Clip;

type Props = {
  clips: AdminClip[];
  reciters: { slug: string; name: string }[];
  riwayat: string[];
  translations: string[];
};

type SavePayload = {
  surah: number;
  ayahStart: number;
  ayahEnd: number;
  reciterSlug: string;
  reciterName: string;
  riwayah: string;
  translation: string;
};

type SaveResponse = {
  clip?: AdminClip;
  data?: AdminClip;
  updatedClip?: AdminClip;
  error?: string;
  message?: string;
};

const defaultForm = (clip: AdminClip): SavePayload => ({
  surah: clip.surah,
  ayahStart: clip.ayahStart,
  ayahEnd: clip.ayahEnd,
  reciterSlug: clip.reciterSlug,
  reciterName: clip.reciterName,
  riwayah: clip.riwayah ?? "hafs-an-asim",
  translation: clip.translation ?? "saheeh-international",
});

function toTelegramUrl(clip: AdminClip): string | null {
  if (clip.telegram?.url) return clip.telegram.url;
  if (clip.telegram?.channelUsername && clip.telegram?.messageId) {
    return `https://t.me/${clip.telegram.channelUsername.replace(/^@/, "")}/${clip.telegram.messageId}`;
  }
  return null;
}

function deriveClipId(payload: SavePayload) {
  return `s${payload.surah}_a${payload.ayahStart}-${payload.ayahEnd}__${payload.reciterSlug}__${payload.riwayah}__${payload.translation}`;
}

export default function ClipManager({ clips, reciters, riwayat, translations }: Props) {
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [clipList, setClipList] = useState<AdminClip[]>(clips);
  const [selectedId, setSelectedId] = useState(clips[0]?.id ?? null);
  const selectedClip = useMemo(
    () => clipList.find((clip) => clip.id === selectedId) ?? null,
    [clipList, selectedId],
  );
  const [form, setForm] = useState<SavePayload>(() =>
    clips[0]
      ? defaultForm(clips[0])
      : {
          surah: 1,
          ayahStart: 1,
          ayahEnd: 1,
          reciterSlug: "",
          reciterName: "",
          riwayah: "hafs-an-asim",
          translation: "saheeh-international",
        },
  );
  const [status, setStatus] = useState<{ type: "idle" | "saving" | "success" | "error"; text: string }>({
    type: "idle",
    text: "",
  });

  useEffect(() => {
    if (!selectedClip) return;
    setForm(defaultForm(selectedClip));
  }, [selectedClip]);

  const filteredClips = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clipList;
    return clipList.filter((clip) => {
      const haystack = [
        clip.id,
        `${clip.surah}`,
        surahNames[clip.surah - 1] ?? "",
        `${clip.ayahStart}`,
        `${clip.ayahEnd}`,
        clip.reciterSlug,
        clip.reciterName,
        clip.riwayah ?? "",
        clip.translation ?? "",
        clip.telegram?.channelUsername ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [clipList, query]);

  const stats = useMemo(() => {
    const telegramLinked = clipList.filter((clip) => toTelegramUrl(clip)).length;
    const edited = clipList.length - telegramLinked;
    return { total: clipList.length, telegramLinked, edited };
  }, [clipList]);

  const saveClip = async () => {
    if (!selectedClip) return;
    const payload = {
      surah: Number(form.surah),
      ayahStart: Number(form.ayahStart),
      ayahEnd: Number(form.ayahEnd),
      reciterSlug: form.reciterSlug.trim(),
      reciterName: form.reciterName.trim(),
      riwayah: form.riwayah.trim(),
      translation: form.translation.trim(),
    };

    setSaving(true);
    setStatus({ type: "saving", text: "Saving clip metadata..." });
    try {
      const res = await fetch(`/api/admin/clips/${encodeURIComponent(selectedClip.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let data: SaveResponse | AdminClip | null = null;
      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok) {
        const errorText =
          (data && "error" in data && data.error) ||
          (data && "message" in data && data.message) ||
          `Failed to save (${res.status})`;
        setStatus({ type: "error", text: errorText || "Failed to save clip metadata" });
        return;
      }

      const updatedClip = (data && typeof data === "object" && !Array.isArray(data) && ("clip" in data || "data" in data || "updatedClip" in data))
        ? (data.clip ?? data.data ?? data.updatedClip ?? null)
        : (data as AdminClip | null);

      const nextClip: AdminClip = updatedClip ?? {
        ...selectedClip,
        ...payload,
        id: deriveClipId(payload),
      };

      setClipList((prev) => {
        const existingIndex = prev.findIndex((clip) => clip.id === selectedClip.id);
        if (existingIndex === -1) return prev;
        const next = [...prev];
        next.splice(existingIndex, 1, nextClip);
        return next;
      });
      setSelectedId(nextClip.id);
      setForm(defaultForm(nextClip));
      setStatus({ type: "success", text: "Saved clip metadata." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
      <aside className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.25em] text-muted-foreground">Clip manager</p>
          <h1 className="text-3xl font-semibold tracking-tight">Studio view</h1>
          <p className="text-sm text-muted-foreground">
            Search clips, inspect uploads, and edit metadata without leaving the page.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
          <Card className="border-border/60 bg-card/70 backdrop-blur">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Total</p>
                <p className="text-2xl font-semibold">{stats.total}</p>
              </div>
              <Badge variant="secondary">{stats.total ? "clips" : "empty"}</Badge>
            </CardContent>
          </Card>
          <Card className="border-border/60 bg-card/70 backdrop-blur">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Telegram</p>
                <p className="text-2xl font-semibold">{stats.telegramLinked}</p>
              </div>
              <Badge variant="outline">linked</Badge>
            </CardContent>
          </Card>
          <Card className="border-border/60 bg-card/70 backdrop-blur">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Needs link</p>
                <p className="text-2xl font-semibold">{stats.edited}</p>
              </div>
              <Badge variant="secondary">review</Badge>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/60 bg-card/70 backdrop-blur">
          <CardHeader className="space-y-3 pb-3">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="clip-search" className="text-sm font-medium">Search clips</Label>
            </div>
            <Input
              id="clip-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by surah, reciter, slug..."
            />
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <ScrollArea className="h-[60vh]">
              <div className="space-y-1 px-3 pb-4">
                {filteredClips.map((clip) => {
                  const isActive = clip.id === selectedId;
                  const telegramUrl = toTelegramUrl(clip);
                  return (
                    <button
                      key={clip.id}
                      type="button"
                      onClick={() => setSelectedId(clip.id)}
                      className={cn(
                        "w-full rounded-xl border px-3 py-3 text-left transition",
                        isActive
                          ? "border-primary/60 bg-primary/10 shadow-sm"
                          : "border-transparent bg-muted/30 hover:border-border hover:bg-muted/50",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {surahNames[clip.surah - 1] ?? `Surah ${clip.surah}`} {clip.ayahStart}-{clip.ayahEnd}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">{clip.reciterName}</p>
                        </div>
                        <ChevronRight className={cn("mt-0.5 h-4 w-4 shrink-0", isActive ? "opacity-100" : "opacity-40")} />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Badge variant="outline" className="text-[11px]">
                          {clip.reciterSlug}
                        </Badge>
                        <Badge variant="secondary" className="text-[11px]">
                          {formatSlug(clip.riwayah ?? "")}
                        </Badge>
                        {telegramUrl && (
                          <Badge variant="default" className="text-[11px]">
                            Telegram
                          </Badge>
                        )}
                      </div>
                    </button>
                  );
                })}
                {filteredClips.length === 0 && (
                  <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                    No clips match the current search.
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </aside>

      <section className="space-y-4">
        <Card className="border-border/60 bg-card/70 backdrop-blur">
          <CardHeader className="space-y-2">
            <CardTitle>Metadata editor</CardTitle>
            <CardDescription>Edit the selected clip and save it back through the admin API.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!selectedClip ? (
              <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                Select a clip to edit its metadata.
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="surah">Surah</Label>
                    <Input id="surah" type="number" min={1} value={form.surah} onChange={(e) => setForm((prev) => ({ ...prev, surah: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ayahStart">Ayah start</Label>
                    <Input id="ayahStart" type="number" min={1} value={form.ayahStart} onChange={(e) => setForm((prev) => ({ ...prev, ayahStart: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ayahEnd">Ayah end</Label>
                    <Input id="ayahEnd" type="number" min={1} value={form.ayahEnd} onChange={(e) => setForm((prev) => ({ ...prev, ayahEnd: Number(e.target.value) }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reciterSlug">Reciter slug</Label>
                    <Input id="reciterSlug" list="reciter-slugs" value={form.reciterSlug} onChange={(e) => setForm((prev) => ({ ...prev, reciterSlug: e.target.value }))} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="reciterName">Reciter name</Label>
                    <Input id="reciterName" value={form.reciterName} onChange={(e) => setForm((prev) => ({ ...prev, reciterName: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="riwayah">Riwayah</Label>
                    <Input id="riwayah" list="riwayat" value={form.riwayah} onChange={(e) => setForm((prev) => ({ ...prev, riwayah: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="translation">Translation</Label>
                    <Input id="translation" list="translations" value={form.translation} onChange={(e) => setForm((prev) => ({ ...prev, translation: e.target.value }))} />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Card className="border-border/60 bg-background/50">
                    <CardContent className="space-y-3 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Current clip</p>
                      <div className="space-y-1 text-sm">
                        <p className="font-medium">{selectedClip.id}</p>
                        <p className="text-muted-foreground">
                          {surahNames[selectedClip.surah - 1] ?? `Surah ${selectedClip.surah}`} {selectedClip.ayahStart}-{selectedClip.ayahEnd}
                        </p>
                        <p className="text-muted-foreground">{selectedClip.reciterName}</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-border/60 bg-background/50">
                    <CardContent className="space-y-3 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Preview id</p>
                      <p className="break-all font-mono text-sm">{deriveClipId(form)}</p>
                    </CardContent>
                  </Card>
                </div>

                {toTelegramUrl(selectedClip) && (
                  <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Telegram post</p>
                    <a
                      href={toTelegramUrl(selectedClip) ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-2 text-sm font-medium underline-offset-4 hover:underline"
                    >
                      Open linked Telegram post
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                )}

                <div className="flex flex-wrap gap-3">
                  <Button type="button" onClick={saveClip} disabled={saving}>
                    <Save className="mr-2 h-4 w-4" />
                    {saving ? "Saving..." : "Save changes"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setForm(defaultForm(selectedClip))}
                  >
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Reset fields
                  </Button>
                  <Button asChild variant="ghost">
                    <Link href={`/`}>Back to site</Link>
                  </Button>
                </div>

                {status.type !== "idle" && (
                  <div
                    className={cn(
                      "rounded-xl border p-4 text-sm",
                      status.type === "success"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                        : status.type === "error"
                          ? "border-red-500/30 bg-red-500/10 text-red-200"
                          : "border-blue-500/30 bg-blue-500/10 text-blue-200",
                    )}
                  >
                    {status.text}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <datalist id="reciter-slugs">
          {reciters.map((reciter) => (
            <option key={reciter.slug} value={reciter.slug} />
          ))}
        </datalist>
        <datalist id="riwayat">
          {riwayat.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
        <datalist id="translations">
          {translations.map((item) => (
            <option key={item} value={item} />
          ))}
        </datalist>
      </section>
    </div>
  );
}
