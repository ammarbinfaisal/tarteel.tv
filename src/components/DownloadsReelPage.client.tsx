"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import type { Clip } from "@/lib/types";
import { useDownloadsList } from "@/lib/client/downloads-hooks";
import DownloadsReelList from "@/components/DownloadsReelList.client";
import { Button } from "@/components/ui/button";

export default function DownloadsReelPage() {
  const { records, loading, error } = useDownloadsList();

  const clips: Clip[] = useMemo(
    () =>
      records.map((r) => ({
        id: r.clipId,
        surah: r.surah,
        ayahStart: r.ayahStart,
        ayahEnd: r.ayahEnd,
        reciterName: r.reciterName,
        reciterSlug: r.reciterSlug,
        riwayah: r.riwayah,
        translation: r.translation as any,
        variants: [
          {
            quality: "high",
            r2Key: r.r2Key,
            url: r.offlineUrl,
          },
        ],
      })),
    [records]
  );

  if (!loading && clips.length === 0) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-3xl border bg-background/80 backdrop-blur p-6 text-center space-y-3">
          <h1 className="text-xl font-bold">No downloads</h1>
          <p className="text-sm text-muted-foreground">Download a clip first to play it offline.</p>
          <Button asChild className="rounded-full">
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[60] rounded-full bg-destructive text-destructive-foreground px-4 py-2 text-xs">
          {error}
        </div>
      )}

      <div className="fixed top-4 left-4 z-[60] pointer-events-auto">
        <Button asChild variant="secondary" size="icon" className="rounded-full">
          <Link href="/downloads" aria-label="Back to downloads">
            <ArrowLeft className="w-5 h-5" />
          </Link>
        </Button>
      </div>

      <DownloadsReelList clips={clips} />
    </>
  );
}

