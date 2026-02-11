import type { Clip, ClipVariant } from "@/lib/types";
import { selectOfflineBaseVariant } from "@/lib/clip-variants";

export type DownloadRecord = {
  clipId: string;
  surah: number;
  ayahStart: number;
  ayahEnd: number;
  reciterName: string;
  reciterSlug: string;
  riwayah?: string;
  translation?: string;
  r2Key: string;
  offlineUrl: string;
  mimeType?: string;
  bytes?: number;
  downloadedAt: number;
};

const DB_NAME = "tarteel-downloads";
const DB_VERSION = 1;
const STORE_NAME = "downloads";

export const DOWNLOADS_CACHE = "downloads-v1";

function requireBrowser() {
  if (typeof window === "undefined") {
    throw new Error("Downloads are only available in the browser.");
  }
  if (!("caches" in window)) {
    throw new Error("Cache Storage is not supported in this browser.");
  }
  if (!("indexedDB" in window)) {
    throw new Error("IndexedDB is not supported in this browser.");
  }
}

function openDb(): Promise<IDBDatabase> {
  requireBrowser();

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "clipId" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function buildOfflineMediaUrl(r2Key: string) {
  const params = new URLSearchParams({ r2Key });
  return `/api/offline-media?${params.toString()}`;
}

function pickOfflineVariant(clip: Clip): ClipVariant | null {
  return selectOfflineBaseVariant(clip.variants) ?? null;
}

export async function getDownloadRecord(clipId: string): Promise<DownloadRecord | null> {
  requireBrowser();
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const record = await txRequest<DownloadRecord | undefined>(store.get(clipId));
  return record ?? null;
}

export async function listDownloadRecords(): Promise<DownloadRecord[]> {
  requireBrowser();
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const records = await txRequest<DownloadRecord[]>(store.getAll());
  return records.sort((a, b) => b.downloadedAt - a.downloadedAt);
}

async function putDownloadRecord(record: DownloadRecord): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  store.put(record);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function deleteDownloadRecord(clipId: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  store.delete(clipId);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export function notifyDownloadsChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("tarteel:downloads-changed"));
}

export async function downloadClipForOffline(clip: Clip): Promise<DownloadRecord> {
  requireBrowser();

  const existing = await getDownloadRecord(clip.id);
  if (existing) return existing;

  const variant = pickOfflineVariant(clip);
  if (!variant) {
    throw new Error("No offline-downloadable media variant found for this clip.");
  }

  const offlineUrl = buildOfflineMediaUrl(variant.r2Key);
  const response = await fetch(offlineUrl);
  if (!response.ok) {
    throw new Error(`Download failed (${response.status})`);
  }

  const cache = await caches.open(DOWNLOADS_CACHE);
  await cache.put(offlineUrl, response.clone());

  const bytesHeader = response.headers.get("content-length");
  const bytes = bytesHeader && /^\d+$/.test(bytesHeader) ? Number(bytesHeader) : undefined;

  const record: DownloadRecord = {
    clipId: clip.id,
    surah: clip.surah,
    ayahStart: clip.ayahStart,
    ayahEnd: clip.ayahEnd,
    reciterName: clip.reciterName,
    reciterSlug: clip.reciterSlug,
    riwayah: clip.riwayah,
    translation: clip.translation,
    r2Key: variant.r2Key,
    offlineUrl,
    mimeType: response.headers.get("content-type") ?? undefined,
    bytes,
    downloadedAt: Date.now(),
  };

  await putDownloadRecord(record);
  notifyDownloadsChanged();
  return record;
}

export async function removeOfflineDownload(clipId: string): Promise<void> {
  requireBrowser();

  const record = await getDownloadRecord(clipId);
  if (record) {
    const cache = await caches.open(DOWNLOADS_CACHE);
    await cache.delete(record.offlineUrl);
  }

  await deleteDownloadRecord(clipId);
  notifyDownloadsChanged();
}

export async function clearOfflineDownloads(): Promise<void> {
  requireBrowser();

  const records = await listDownloadRecords();
  const cache = await caches.open(DOWNLOADS_CACHE);
  await Promise.all(records.map((r) => cache.delete(r.offlineUrl)));

  const db = await openDb();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).clear();
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

  notifyDownloadsChanged();
}
