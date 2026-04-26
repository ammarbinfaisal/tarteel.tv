"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { DownloadRecord } from "@/lib/client/downloads";
import { getDownloadRecord, listDownloadRecords } from "@/lib/client/downloads";
import { useMountEffect } from "@/hooks/useMountEffect";

function subscribeDownloadsChanged(onChange: () => void) {
  window.addEventListener("tarteel:downloads-changed", onChange);
  return () => window.removeEventListener("tarteel:downloads-changed", onChange);
}

export function useOnlineStatus() {
  const [online, setOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));

  useMountEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  });

  return online;
}

export function useDownloadRecord(clipId: string) {
  const [record, setRecord] = useState<DownloadRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stable fetch that takes clipId as argument — never changes identity
  const doFetch = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const r = await getDownloadRecord(id);
      setRecord(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRecord(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Keep clipId in a ref so the mount-time subscription always reads the latest
  const clipIdRef = useRef(clipId);
  clipIdRef.current = clipId;

  const refresh = useCallback(() => doFetch(clipIdRef.current), [doFetch]);

  // Subscribe once; the handler always calls refresh which reads clipIdRef.current
  useMountEffect(() => {
    refresh();
    return subscribeDownloadsChanged(refresh);
  });

  // Re-fetch when clipId changes (derived-state pattern: setState during render)
  const prevClipId = useRef(clipId);
  if (prevClipId.current !== clipId) {
    prevClipId.current = clipId;
    // Schedule the async fetch after this render commits
    queueMicrotask(refresh);
  }

  return { record, loading, error, refresh };
}

export function useDownloadsList() {
  const [records, setRecords] = useState<DownloadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await listDownloadRecords();
      setRecords(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useMountEffect(() => {
    refresh();
    return subscribeDownloadsChanged(() => refresh());
  });

  const totals = useMemo(() => {
    const bytes = records.reduce((sum, r) => sum + (r.bytes ?? 0), 0);
    return { count: records.length, bytes };
  }, [records]);

  return { records, totals, loading, error, refresh };
}
