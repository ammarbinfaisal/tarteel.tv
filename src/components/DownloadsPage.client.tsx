"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Play, WifiOff } from "lucide-react";
import { clearOfflineDownloads, removeOfflineDownload } from "@/lib/client/downloads";
import { useDownloadsList, useOnlineStatus } from "@/lib/client/downloads-hooks";
import { formatTranslation, formatSlug, getSurahName } from "@/lib/utils";

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let idx = 0;
  let value = bytes;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx++;
  }
  return `${value.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

export default function DownloadsPage() {
  const { records, totals, loading, error } = useDownloadsList();
  const online = useOnlineStatus();
  const [storageEstimate, setStorageEstimate] = useState<{ usage?: number; quota?: number } | null>(null);

  useEffect(() => {
    (async () => {
      if (!("storage" in navigator) || !navigator.storage.estimate) return;
      const est = await navigator.storage.estimate();
      setStorageEstimate({ usage: est.usage ?? undefined, quota: est.quota ?? undefined });
    })();
  }, []);

  const estimateText = useMemo(() => {
    if (!storageEstimate?.usage || !storageEstimate?.quota) return null;
    return `${formatBytes(storageEstimate.usage)} used of ${formatBytes(storageEstimate.quota)}`;
  }, [storageEstimate]);

  const onClearAll = async () => {
    const ok = confirm("Clear all offline downloads?");
    if (!ok) return;
    await clearOfflineDownloads();
  };

  return (
    <div className="container py-8 max-w-2xl">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Downloads</h1>
          <div className="flex flex-wrap items-center gap-2">
            {!online && (
              <Badge variant="secondary" className="gap-1">
                <WifiOff className="w-3.5 h-3.5" />
                Offline
              </Badge>
            )}
            <p className="text-sm text-muted-foreground">
              {totals.count} clip{totals.count === 1 ? "" : "s"} · {formatBytes(totals.bytes)}
              {estimateText ? ` · ${estimateText}` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="secondary" className="rounded-full">
            <Link href="/downloads/reel">Play</Link>
          </Button>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={onClearAll}
            disabled={totals.count === 0}
            title="Clear all downloads"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {loading && <div className="text-sm text-muted-foreground">Loading downloads…</div>}
        {error && <div className="text-sm text-destructive">{error}</div>}

        {!loading && records.length === 0 && (
          <div className="rounded-2xl border p-6 text-center text-sm text-muted-foreground">
            No downloads yet. Open a reel and use the download menu to save a clip for offline playback.
          </div>
        )}

        {records.map((r) => (
          <div key={r.clipId} className="rounded-2xl border p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="font-semibold truncate">
                {r.reciterName} · {getSurahName(r.surah)}:{r.ayahStart}-{r.ayahEnd}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {r.riwayah ? formatSlug(r.riwayah) : ""}{" "}
                {r.translation ? `· ${formatTranslation(r.translation)}` : ""}
              </div>
              <div className="text-[11px] text-muted-foreground">
                Downloaded {new Date(r.downloadedAt).toLocaleString()}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button asChild variant="secondary" size="icon" className="rounded-full" title="Play">
                <Link href={`/downloads/reel?clipId=${encodeURIComponent(r.clipId)}`}>
                  <Play className="w-4 h-4" />
                </Link>
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="rounded-full"
                title="Remove download"
                onClick={() => removeOfflineDownload(r.clipId)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

