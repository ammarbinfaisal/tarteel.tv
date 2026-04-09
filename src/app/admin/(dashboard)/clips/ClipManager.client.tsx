"use client";

import type { Route } from "next";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, ExternalLink, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatSlug, surahNames } from "@/lib/utils";
import type { Clip } from "@/lib/types";

type AdminClip = Clip;

type Props = {
  clips: AdminClip[];
};

function toTelegramUrl(clip: AdminClip): string | null {
  if (clip.telegram?.url) return clip.telegram.url;
  if (clip.telegram?.channelUsername && clip.telegram?.messageId) {
    return `https://t.me/${clip.telegram.channelUsername.replace(/^@/, "")}/${clip.telegram.messageId}`;
  }
  return null;
}

export default function ClipManager({ clips }: Props) {
  const [query, setQuery] = useState("");

  const filteredClips = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return clips;

    return clips.filter((clip) => {
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

      return haystack.includes(normalizedQuery);
    });
  }, [clips, query]);

  const stats = useMemo(() => {
    const telegramLinked = clips.filter((clip) => toTelegramUrl(clip)).length;
    return {
      total: clips.length,
      telegramLinked,
      withoutTelegram: clips.length - telegramLinked,
    };
  }, [clips]);

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.25em] text-muted-foreground">Clip manager</p>
          <h1 className="text-3xl font-semibold tracking-tight">Choose a clip to edit</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Search clips, inspect their current metadata, then open the dedicated edit page for that clip.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="border-border/60 bg-card/70 backdrop-blur">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Total</p>
              <p className="mt-1 text-2xl font-semibold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card className="border-border/60 bg-card/70 backdrop-blur">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Telegram linked</p>
              <p className="mt-1 text-2xl font-semibold">{stats.telegramLinked}</p>
            </CardContent>
          </Card>
          <Card className="border-border/60 bg-card/70 backdrop-blur">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Needs review</p>
              <p className="mt-1 text-2xl font-semibold">{stats.withoutTelegram}</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <Card className="border-border/60 bg-card/70 backdrop-blur">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="clip-search" className="text-sm font-medium">
              Search clips
            </Label>
          </div>
          <Input
            id="clip-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by surah, ayah, reciter, riwayah, translation, or id..."
          />
          <CardDescription>
            Open a clip to edit its canonical ID and metadata on a dedicated page.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <ScrollArea className="h-[68vh]">
            <div className="space-y-3 px-4 pb-4">
              {filteredClips.map((clip) => {
                const telegramUrl = toTelegramUrl(clip);
                return (
                  <Link
                    key={clip.id}
                    href={`/admin/clips/clip/${encodeURIComponent(clip.id)}` as Route}
                    className="block rounded-2xl border border-border/60 bg-background/50 p-4 transition hover:border-primary/40 hover:bg-background"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-base font-medium">
                          {surahNames[clip.surah - 1] ?? `Surah ${clip.surah}`} {clip.ayahStart}-{clip.ayahEnd}
                        </p>
                        <p className="truncate text-sm text-muted-foreground">{clip.reciterName}</p>
                      </div>
                      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="text-[11px]">
                        {clip.reciterSlug}
                      </Badge>
                      <Badge variant="secondary" className="text-[11px]">
                        {formatSlug(clip.riwayah ?? "")}
                      </Badge>
                      <Badge variant="secondary" className="text-[11px]">
                        {clip.translation ?? ""}
                      </Badge>
                      {telegramUrl && <Badge className="text-[11px]">Telegram</Badge>}
                      {clip.archivedAt && <Badge variant="destructive" className="text-[11px]">Archived</Badge>}
                    </div>

                    <p className="mt-3 break-all font-mono text-xs text-muted-foreground">{clip.id}</p>

                    {telegramUrl && (
                      <span className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground">
                        Linked Telegram post
                        <ExternalLink className="h-3 w-3" />
                      </span>
                    )}
                  </Link>
                );
              })}

              {filteredClips.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
                  No clips match the current search.
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
