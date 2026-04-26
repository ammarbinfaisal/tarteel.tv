"use client";

import type { Route } from "next";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, RefreshCcw, Save, Archive } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, formatSlug, formatTranslation, surahNames } from "@/lib/utils";
import type { Clip } from "@/lib/types";

type AdminClip = Clip;

type Props = {
  clip: AdminClip;
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

const CUSTOM_OPTION = "__custom__";

function defaultForm(clip: AdminClip): SavePayload {
  return {
    surah: clip.surah,
    ayahStart: clip.ayahStart,
    ayahEnd: clip.ayahEnd,
    reciterSlug: clip.reciterSlug,
    reciterName: clip.reciterName,
    riwayah: clip.riwayah ?? "hafs-an-asim",
    translation: clip.translation ?? "saheeh-international",
  };
}

function humanizeSlug(slug: string) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function deriveClipId(payload: SavePayload) {
  return `s${payload.surah}_a${payload.ayahStart}-${payload.ayahEnd}__${payload.reciterSlug}__${payload.riwayah}__${payload.translation}`;
}

function parseCanonicalClipId(value: string) {
  const match = value.trim().match(/^s(\d+)_a(\d+)-(\d+)__(.+?)__(.+?)__(.+)$/);
  if (!match) return null;

  const surah = Number.parseInt(match[1], 10);
  const ayahStart = Number.parseInt(match[2], 10);
  const ayahEnd = Number.parseInt(match[3], 10);
  const reciterSlug = match[4]?.trim();
  const riwayah = match[5]?.trim();
  const translation = match[6]?.trim();

  if (
    !Number.isFinite(surah) ||
    !Number.isFinite(ayahStart) ||
    !Number.isFinite(ayahEnd) ||
    surah < 1 ||
    ayahStart < 1 ||
    ayahEnd < ayahStart ||
    !reciterSlug ||
    !riwayah ||
    !translation
  ) {
    return null;
  }

  return {
    surah,
    ayahStart,
    ayahEnd,
    reciterSlug,
    riwayah,
    translation,
  };
}

function toTelegramUrl(clip: AdminClip): string | null {
  if (clip.telegram?.url) return clip.telegram.url;
  if (clip.telegram?.channelUsername && clip.telegram?.messageId) {
    return `https://t.me/${clip.telegram.channelUsername.replace(/^@/, "")}/${clip.telegram.messageId}`;
  }
  return null;
}

function mergeKnownValues(values: string[], currentValue: string, fallbackValue: string) {
  return Array.from(new Set([...values, currentValue, fallbackValue].filter(Boolean))).sort();
}

export default function ClipMetadataEditor({ clip, reciters, riwayat, translations }: Props) {
  const router = useRouter();
  const [currentClip, setCurrentClip] = useState<AdminClip>(clip);
  const [form, setForm] = useState<SavePayload>(() => defaultForm(clip));
  const [idInput, setIdInput] = useState(clip.id);
  const [idDirty, setIdDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [status, setStatus] = useState<{ type: "idle" | "saving" | "success" | "error"; text: string }>({
    type: "idle",
    text: "",
  });

  const reciterMap = useMemo(() => new Map(reciters.map((reciter) => [reciter.slug, reciter])), [reciters]);
  const baseRiwayat = useMemo(() => mergeKnownValues(riwayat, "", "hafs-an-asim"), [riwayat]);
  const baseTranslations = useMemo(
    () => mergeKnownValues(translations, "", "saheeh-international"),
    [translations],
  );
  const knownRiwayat = useMemo(
    () => mergeKnownValues(riwayat, form.riwayah, "hafs-an-asim"),
    [form.riwayah, riwayat],
  );
  const knownTranslations = useMemo(
    () => mergeKnownValues(translations, form.translation, "saheeh-international"),
    [form.translation, translations],
  );

  const derivedId = useMemo(() => deriveClipId(form), [form]);
  const parsedCustomId = useMemo(() => parseCanonicalClipId(idInput), [idInput]);
  const idValidationError = useMemo(() => {
    if (!idDirty) return null;
    if (idInput.trim() === derivedId) return null;
    return parsedCustomId ? null : "Clip ID must match s<surah>_a<start>-<end>__<reciter>__<riwayah>__<translation>.";
  }, [derivedId, idDirty, idInput, parsedCustomId]);

  // Derived state: keep idInput in sync with derivedId when user hasn't manually edited it
  const prevDerivedId = useRef(derivedId);
  if (prevDerivedId.current !== derivedId) {
    prevDerivedId.current = derivedId;
    if (!idDirty) {
      setIdInput(derivedId);
    }
  }

  const selectedReciterValue = reciterMap.has(form.reciterSlug) ? form.reciterSlug : CUSTOM_OPTION;
  const selectedRiwayahValue = baseRiwayat.includes(form.riwayah) ? form.riwayah : CUSTOM_OPTION;
  const selectedTranslationValue = baseTranslations.includes(form.translation) ? form.translation : CUSTOM_OPTION;
  const telegramUrl = toTelegramUrl(currentClip);

  function syncFormFromId() {
    const parsed = parseCanonicalClipId(idInput);
    if (!parsed) {
      setStatus({ type: "error", text: "Enter a valid canonical clip ID before applying it." });
      return;
    }

    const matchingReciter = reciterMap.get(parsed.reciterSlug);
    const nextForm = {
      ...form,
      ...parsed,
      reciterName: matchingReciter?.name ?? humanizeSlug(parsed.reciterSlug),
    };

    setForm(nextForm);
    setIdInput(deriveClipId(nextForm));
    setIdDirty(false);
    setStatus({ type: "idle", text: "" });
  }

  async function saveClip() {
    const normalizedForm = {
      surah: Number(form.surah),
      ayahStart: Number(form.ayahStart),
      ayahEnd: Number(form.ayahEnd),
      reciterSlug: form.reciterSlug.trim(),
      reciterName: form.reciterName.trim(),
      riwayah: form.riwayah.trim(),
      translation: form.translation.trim(),
    };

    let payload: SavePayload = normalizedForm;

    if (idInput.trim() !== deriveClipId(normalizedForm)) {
      const parsed = parseCanonicalClipId(idInput);
      if (!parsed) {
        setStatus({ type: "error", text: "Clip ID is invalid. Fix it or sync it from the fields before saving." });
        return;
      }

      const matchingReciter = reciterMap.get(parsed.reciterSlug);
      payload = {
        ...normalizedForm,
        ...parsed,
        reciterName:
          matchingReciter?.name ??
          (parsed.reciterSlug === normalizedForm.reciterSlug
            ? normalizedForm.reciterName || humanizeSlug(parsed.reciterSlug)
            : humanizeSlug(parsed.reciterSlug)),
      };
    }

    setSaving(true);
    setStatus({ type: "saving", text: "Saving clip metadata..." });

    try {
      const response = await fetch(`/api/admin/clips/${encodeURIComponent(currentClip.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let data: SaveResponse | AdminClip | null = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        const errorText =
          (data && "error" in data && data.error) ||
          (data && "message" in data && data.message) ||
          `Failed to save (${response.status})`;

        setStatus({ type: "error", text: errorText || "Failed to save clip metadata." });
        return;
      }

      const updatedClip =
        data &&
        typeof data === "object" &&
        !Array.isArray(data) &&
        ("clip" in data || "data" in data || "updatedClip" in data)
          ? (data.clip ?? data.data ?? data.updatedClip ?? null)
          : (data as AdminClip | null);

      const nextClip: AdminClip = updatedClip ?? {
        ...currentClip,
        ...payload,
        id: deriveClipId(payload),
      };

      setCurrentClip(nextClip);
      setForm(defaultForm(nextClip));
      setIdInput(nextClip.id);
      setIdDirty(false);
      setStatus({ type: "success", text: "Saved clip metadata." });

      if (nextClip.id !== currentClip.id) {
        router.replace(`/admin/clips/clip/${encodeURIComponent(nextClip.id)}` as Route);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!confirmArchive) {
      setConfirmArchive(true);
      return;
    }

    setArchiving(true);
    setStatus({ type: "saving", text: "Archiving clip..." });

    try {
      const ingestEndpoint = process.env.NEXT_PUBLIC_INGEST_ENDPOINT!;
      const response = await fetch(`${ingestEndpoint}/clips/${encodeURIComponent(currentClip.id)}`, {
        method: "DELETE",
        credentials: "include",
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setStatus({ type: "error", text: data?.error ?? `Archive failed (${response.status})` });
        return;
      }

      setStatus({ type: "success", text: `Archived. Deleted ${data?.deletedR2Objects ?? 0} R2 objects.` });
      router.replace("/admin/clips" as Route);
    } finally {
      setArchiving(false);
      setConfirmArchive(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-wider text-muted-foreground">Clip editor</p>
          <h1 className="text-3xl font-semibold tracking-tight">Edit clip metadata</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Update the canonical ID, metadata fields, and linked values for this clip.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/clips">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to clips
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/">Back to site</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
        <Card className="border-border/60 bg-card/70 backdrop-blur">
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
            <CardDescription>
              The clip ID is editable. Change the fields below, or paste a canonical ID and apply it to the form.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="clipId">Canonical clip ID</Label>
              <Input
                id="clipId"
                value={idInput}
                onChange={(event) => {
                  setIdInput(event.target.value);
                  setIdDirty(true);
                }}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={syncFormFromId}>
                  Apply ID to fields
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setIdInput(derivedId);
                    setIdDirty(false);
                  }}
                >
                  Reset ID from fields
                </Button>
              </div>
              {idValidationError && <p className="text-sm text-red-300">{idValidationError}</p>}
              {!idValidationError && idDirty && idInput.trim() !== derivedId && parsedCustomId && (
                <p className="text-sm text-amber-300">
                  Saving will use the metadata encoded in this ID unless you reset or apply it first.
                </p>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="surah">Surah</Label>
                <Input
                  id="surah"
                  type="number"
                  min={1}
                  value={form.surah}
                  onChange={(event) => setForm((prev) => ({ ...prev, surah: Number(event.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ayahStart">Ayah start</Label>
                <Input
                  id="ayahStart"
                  type="number"
                  min={1}
                  value={form.ayahStart}
                  onChange={(event) => setForm((prev) => ({ ...prev, ayahStart: Number(event.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ayahEnd">Ayah end</Label>
                <Input
                  id="ayahEnd"
                  type="number"
                  min={1}
                  value={form.ayahEnd}
                  onChange={(event) => setForm((prev) => ({ ...prev, ayahEnd: Number(event.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Reciter</Label>
                <Select
                  value={selectedReciterValue}
                  onValueChange={(value) => {
                    if (value === CUSTOM_OPTION) {
                      setForm((prev) => ({ ...prev, reciterSlug: reciterMap.has(prev.reciterSlug) ? "" : prev.reciterSlug }));
                      return;
                    }

                    const reciter = reciterMap.get(value);
                    setForm((prev) => ({
                      ...prev,
                      reciterSlug: value,
                      reciterName: reciter?.name ?? prev.reciterName,
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select reciter" />
                  </SelectTrigger>
                  <SelectContent>
                    {reciters.map((reciter) => (
                      <SelectItem key={reciter.slug} value={reciter.slug}>
                        {reciter.name}
                      </SelectItem>
                    ))}
                    <SelectItem value={CUSTOM_OPTION}>Custom reciter</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedReciterValue === CUSTOM_OPTION && (
                <div className="space-y-2">
                  <Label htmlFor="reciterSlug">Custom reciter slug</Label>
                  <Input
                    id="reciterSlug"
                    value={form.reciterSlug}
                    onChange={(event) => setForm((prev) => ({ ...prev, reciterSlug: event.target.value }))}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="reciterName">Reciter name</Label>
                <Input
                  id="reciterName"
                  value={form.reciterName}
                  onChange={(event) => setForm((prev) => ({ ...prev, reciterName: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Riwayah</Label>
                <Select
                  value={selectedRiwayahValue}
                  onValueChange={(value) => {
                    if (value === CUSTOM_OPTION) {
                      setForm((prev) => ({ ...prev, riwayah: baseRiwayat.includes(prev.riwayah) ? "" : prev.riwayah }));
                      return;
                    }

                    setForm((prev) => ({ ...prev, riwayah: value }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select riwayah" />
                  </SelectTrigger>
                  <SelectContent>
                    {knownRiwayat.map((item) => (
                      <SelectItem key={item} value={item}>
                        {formatSlug(item)}
                      </SelectItem>
                    ))}
                    <SelectItem value={CUSTOM_OPTION}>Custom riwayah</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedRiwayahValue === CUSTOM_OPTION && (
                <div className="space-y-2">
                  <Label htmlFor="riwayah">Custom riwayah</Label>
                  <Input
                    id="riwayah"
                    value={form.riwayah}
                    onChange={(event) => setForm((prev) => ({ ...prev, riwayah: event.target.value }))}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Translation</Label>
                <Select
                  value={selectedTranslationValue}
                  onValueChange={(value) => {
                    if (value === CUSTOM_OPTION) {
                      setForm((prev) => ({
                        ...prev,
                        translation: baseTranslations.includes(prev.translation) ? "" : prev.translation,
                      }));
                      return;
                    }

                    setForm((prev) => ({ ...prev, translation: value }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select translation" />
                  </SelectTrigger>
                  <SelectContent>
                    {knownTranslations.map((item) => (
                      <SelectItem key={item} value={item}>
                        {formatTranslation(item)}
                      </SelectItem>
                    ))}
                    <SelectItem value={CUSTOM_OPTION}>Custom translation</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedTranslationValue === CUSTOM_OPTION && (
                <div className="space-y-2">
                  <Label htmlFor="translation">Custom translation</Label>
                  <Input
                    id="translation"
                    value={form.translation}
                    onChange={(event) => setForm((prev) => ({ ...prev, translation: event.target.value }))}
                  />
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={saveClip} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save changes"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  const nextForm = defaultForm(currentClip);
                  setForm(nextForm);
                  setIdInput(currentClip.id);
                  setIdDirty(false);
                  setStatus({ type: "idle", text: "" });
                }}
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                Reset
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
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-border/60 bg-card/70 backdrop-blur">
            <CardHeader>
              <CardTitle>Current clip</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Stored ID</p>
                <p className="mt-1 break-all font-mono">{currentClip.id}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Surah / ayahs</p>
                <p className="mt-1">
                  {surahNames[currentClip.surah - 1] ?? `Surah ${currentClip.surah}`} {currentClip.ayahStart}-{currentClip.ayahEnd}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Reciter</p>
                <p className="mt-1">{currentClip.reciterName}</p>
                <p className="text-muted-foreground">{currentClip.reciterSlug}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="rounded-full bg-muted px-2 py-1 text-xs">{formatSlug(currentClip.riwayah ?? "")}</span>
                <span className="rounded-full bg-muted px-2 py-1 text-xs">{formatTranslation(currentClip.translation ?? "")}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 bg-card/70 backdrop-blur">
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>What the ID resolves to from the current field values.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="break-all font-mono text-sm">{derivedId}</p>
            </CardContent>
          </Card>

          {telegramUrl && (
            <Card className="border-border/60 bg-card/70 backdrop-blur">
              <CardHeader>
                <CardTitle>Telegram post</CardTitle>
              </CardHeader>
              <CardContent>
                <a
                  href={telegramUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium underline-offset-4 hover:underline"
                >
                  Open linked Telegram post
                  <ExternalLink className="h-4 w-4" />
                </a>
              </CardContent>
            </Card>
          )}

          <Card className="border-red-500/30 bg-card/70 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-red-300">Archive clip</CardTitle>
              <CardDescription>
                Permanently removes R2 files and deletes the Telegram post. The clip record is kept but marked as archived.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {confirmArchive && (
                <p className="text-sm text-red-300">
                  Are you sure? This will delete all video files from R2 and remove the Telegram post. This cannot be undone.
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleArchive}
                  disabled={archiving || saving}
                >
                  <Archive className="mr-2 h-4 w-4" />
                  {archiving ? "Archiving..." : confirmArchive ? "Confirm archive" : "Archive clip"}
                </Button>
                {confirmArchive && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setConfirmArchive(false)}
                    disabled={archiving}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
