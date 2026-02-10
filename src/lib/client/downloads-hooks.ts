"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DownloadRecord } from "@/lib/client/downloads";
import { getDownloadRecord, listDownloadRecords } from "@/lib/client/downloads";

function subscribeDownloadsChanged(onChange: () => void) {
  window.addEventListener("tarteel:downloads-changed", onChange);
  return () => window.removeEventListener("tarteel:downloads-changed", onChange);
}

export function useOnlineStatus() {
  const [online, setOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return online;
}

export function useDownloadRecord(clipId: string) {
  const [record, setRecord] = useState<DownloadRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await getDownloadRecord(clipId);
      setRecord(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setRecord(null);
    } finally {
      setLoading(false);
    }
  }, [clipId]);

  useEffect(() => {
    refresh();
    return subscribeDownloadsChanged(() => refresh());
  }, [refresh]);

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

  useEffect(() => {
    refresh();
    return subscribeDownloadsChanged(() => refresh());
  }, [refresh]);

  const totals = useMemo(() => {
    const bytes = records.reduce((sum, r) => sum + (r.bytes ?? 0), 0);
    return { count: records.length, bytes };
  }, [records]);

  return { records, totals, loading, error, refresh };
}

