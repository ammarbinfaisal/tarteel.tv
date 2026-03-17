"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn, surahNames, formatSlug, formatTranslation } from "@/lib/utils";

// Verse counts per surah (index 0 = Al-Fatihah = 7 verses)
const verseCounts = [7,286,200,176,120,165,206,75,129,109,123,111,43,52,99,128,111,110,98,135,112,78,118,64,77,227,93,88,69,60,34,30,73,54,45,83,182,88,75,85,54,53,89,59,37,35,38,29,18,45,60,49,62,55,78,96,29,22,24,13,14,11,11,18,12,12,30,52,52,44,28,28,20,56,40,31,50,40,46,42,29,19,36,25,22,17,19,26,30,20,15,21,11,8,8,19,5,8,8,11,11,8,3,9,5,4,7,3,6,3,5,4,5,6];

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

  // Controlled state for all selectors
  const [selectedSurahs, setSelectedSurahs] = useState<number[]>([1]);
  const [ayahStart, setAyahStart] = useState("1");
  const [ayahEnd, setAyahEnd] = useState("1");
  const [selectedReciter, setSelectedReciter] = useState(reciters[0]?.slug ?? "");
  const [customReciterSlug, setCustomReciterSlug] = useState("");
  const [reciterName, setReciterName] = useState("");
  const [selectedRiwayah, setSelectedRiwayah] = useState("hafs-an-asim");
  const [customRiwayah, setCustomRiwayah] = useState("");
  const [selectedTranslation, setSelectedTranslation] = useState("saheeh-international");
  const [customTranslation, setCustomTranslation] = useState("");

  // Popover open states
  const [surahOpen, setSurahOpen] = useState(false);
  const [reciterOpen, setReciterOpen] = useState(false);
  const [riwayahOpen, setRiwayahOpen] = useState(false);
  const [translationOpen, setTranslationOpen] = useState(false);

  const multiSurah = selectedSurahs.length > 1;

  // Ayah range validation
  const maxAyah = useMemo(() => {
    if (selectedSurahs.length !== 1) return null;
    return verseCounts[selectedSurahs[0] - 1] ?? null;
  }, [selectedSurahs]);

  const ayahError = useMemo(() => {
    if (multiSurah || !maxAyah) return null;
    const start = parseInt(ayahStart);
    const end = parseInt(ayahEnd);
    if (isNaN(start) || isNaN(end)) return null;
    if (start < 1) return "Start must be at least 1";
    if (end < start) return "End must be >= start";
    if (end > maxAyah) return `Surah ${selectedSurahs[0]} only has ${maxAyah} ayahs`;
    return null;
  }, [ayahStart, ayahEnd, maxAyah, multiSurah, selectedSurahs]);

  // Ensure all riwayat includes hafs-an-asim
  const allRiwayat = useMemo(() => {
    const set = new Set(riwayat);
    set.add("hafs-an-asim");
    return Array.from(set).sort();
  }, [riwayat]);

  // Ensure all translations includes saheeh-international
  const allTranslations = useMemo(() => {
    const set = new Set(translations);
    set.add("saheeh-international");
    return Array.from(set).sort();
  }, [translations]);

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
    if (ayahError) {
      setMessage({ type: "error", text: ayahError });
      return;
    }
    if (selectedSurahs.length === 0) {
      setMessage({ type: "error", text: "Select at least one surah" });
      return;
    }

    setLoading(true);
    setMessage({ type: "info", text: "Uploading file..." });

    const formData = new FormData(e.currentTarget);

    // Override form values with controlled state
    formData.set("surah", String(selectedSurahs[0]));
    formData.set("ayahStart", multiSurah ? "1" : ayahStart);
    formData.set("ayahEnd", multiSurah ? String(verseCounts[selectedSurahs[0] - 1]) : ayahEnd);
    formData.set("reciterSlug", selectedReciter === "custom" ? customReciterSlug : selectedReciter);
    formData.set("reciterName", reciterName);
    formData.set("riwayah", selectedRiwayah === "custom" ? customRiwayah : selectedRiwayah);
    formData.set("translation", selectedTranslation === "custom" ? customTranslation : selectedTranslation);

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

  const surahLabel =
    selectedSurahs.length === 0
      ? "Select surah..."
      : selectedSurahs.length === 1
        ? `${selectedSurahs[0]}. ${surahNames[selectedSurahs[0] - 1]}`
        : `${selectedSurahs.length} surahs selected`;

  const reciterLabel =
    selectedReciter === "custom"
      ? "Custom..."
      : (reciters.find((r) => r.slug === selectedReciter)?.name ?? selectedReciter) || "Select reciter...";

  const riwayahLabel =
    selectedRiwayah === "custom"
      ? "Custom..."
      : formatSlug(selectedRiwayah) || "Select riwayah...";

  const translationLabel =
    selectedTranslation === "custom"
      ? "Custom..."
      : formatTranslation(selectedTranslation) || "Select translation...";

  return (
    <Card>
      <CardContent className="pt-6">
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
          {/* Surah — searchable multi-select */}
          <div className="space-y-2">
            <Label>Surah</Label>
            <Popover open={surahOpen} onOpenChange={setSurahOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={surahOpen}
                  className="w-full justify-between font-normal px-3"
                >
                  <span className="truncate">{surahLabel}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search surah..." />
                  <CommandList className="max-h-[300px]">
                    <CommandEmpty>No surah found.</CommandEmpty>
                    <CommandGroup>
                      {surahNames.map((name, index) => {
                        const num = index + 1;
                        const isSelected = selectedSurahs.includes(num);
                        return (
                          <CommandItem
                            key={num}
                            value={`${num} ${name}`}
                            onSelect={() => {
                              setSelectedSurahs((prev) =>
                                isSelected
                                  ? prev.filter((s) => s !== num)
                                  : [...prev, num].sort((a, b) => a - b),
                              );
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                            {num}. {name}
                            <span className="ml-auto text-xs text-muted-foreground">{verseCounts[index]} ayahs</span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {selectedSurahs.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedSurahs.map((num) => (
                  <span
                    key={num}
                    className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-primary/10 text-xs font-medium"
                  >
                    {num}. {surahNames[num - 1]}
                    <button
                      type="button"
                      className="rounded-full p-0.5 hover:bg-primary/20"
                      onClick={() => setSelectedSurahs((prev) => prev.filter((s) => s !== num))}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Ayah Range — hidden when multi-surah */}
          {!multiSurah && selectedSurahs.length === 1 && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ayahStart">Ayah Start</Label>
                  <Input
                    id="ayahStart"
                    name="ayahStart"
                    type="number"
                    min="1"
                    max={maxAyah ?? undefined}
                    required
                    value={ayahStart}
                    onChange={(e) => setAyahStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ayahEnd">Ayah End</Label>
                  <Input
                    id="ayahEnd"
                    name="ayahEnd"
                    type="number"
                    min="1"
                    max={maxAyah ?? undefined}
                    required
                    value={ayahEnd}
                    onChange={(e) => setAyahEnd(e.target.value)}
                  />
                </div>
              </div>
              {maxAyah && (
                <p className="text-xs text-muted-foreground">
                  Surah {selectedSurahs[0]} ({surahNames[selectedSurahs[0] - 1]}) has {maxAyah} ayahs
                </p>
              )}
              {ayahError && (
                <p className="text-xs text-red-400">{ayahError}</p>
              )}
            </div>
          )}

          {/* Reciter — searchable select */}
          <div className="space-y-2">
            <Label>Reciter</Label>
            <Popover open={reciterOpen} onOpenChange={setReciterOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={reciterOpen}
                  className="w-full justify-between font-normal px-3"
                >
                  <span className="truncate">{reciterLabel}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search reciter..." />
                  <CommandList className="max-h-[300px]">
                    <CommandEmpty>No reciter found.</CommandEmpty>
                    <CommandGroup>
                      {reciters.map((r) => (
                        <CommandItem
                          key={r.slug}
                          value={r.name}
                          onSelect={() => {
                            setSelectedReciter(r.slug);
                            setReciterOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", selectedReciter === r.slug ? "opacity-100" : "opacity-0")} />
                          {r.name}
                        </CommandItem>
                      ))}
                      <CommandItem
                        value="custom"
                        onSelect={() => {
                          setSelectedReciter("custom");
                          setReciterOpen(false);
                        }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", selectedReciter === "custom" ? "opacity-100" : "opacity-0")} />
                        -- Custom Slug --
                      </CommandItem>
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            {selectedReciter === "custom" && (
              <div className="space-y-2 pt-2">
                <Input
                  name="customReciterSlug"
                  placeholder="e.g. mishary-rashid"
                  value={customReciterSlug}
                  onChange={(e) => setCustomReciterSlug(e.target.value)}
                />
                <Input
                  name="reciterName"
                  placeholder="Reciter display name"
                  value={reciterName}
                  onChange={(e) => setReciterName(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Riwayah — searchable select */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Riwayah</Label>
              <Popover open={riwayahOpen} onOpenChange={setRiwayahOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={riwayahOpen}
                    className="w-full justify-between font-normal px-3"
                  >
                    <span className="truncate">{riwayahLabel}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search riwayah..." />
                    <CommandList className="max-h-[300px]">
                      <CommandEmpty>No riwayah found.</CommandEmpty>
                      <CommandGroup>
                        {allRiwayat.map((r) => (
                          <CommandItem
                            key={r}
                            value={r}
                            onSelect={() => {
                              setSelectedRiwayah(r);
                              setRiwayahOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedRiwayah === r ? "opacity-100" : "opacity-0")} />
                            {formatSlug(r)}
                          </CommandItem>
                        ))}
                        <CommandItem
                          value="custom"
                          onSelect={() => {
                            setSelectedRiwayah("custom");
                            setRiwayahOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", selectedRiwayah === "custom" ? "opacity-100" : "opacity-0")} />
                          -- Custom --
                        </CommandItem>
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {selectedRiwayah === "custom" && (
                <Input
                  className="mt-2"
                  placeholder="Custom riwayah slug"
                  value={customRiwayah}
                  onChange={(e) => setCustomRiwayah(e.target.value)}
                />
              )}
            </div>

            {/* Translation — searchable select */}
            <div className="space-y-2">
              <Label>Translation</Label>
              <Popover open={translationOpen} onOpenChange={setTranslationOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={translationOpen}
                    className="w-full justify-between font-normal px-3"
                  >
                    <span className="truncate">{translationLabel}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search translation..." />
                    <CommandList className="max-h-[300px]">
                      <CommandEmpty>No translation found.</CommandEmpty>
                      <CommandGroup>
                        {allTranslations.map((t) => (
                          <CommandItem
                            key={t}
                            value={t}
                            onSelect={() => {
                              setSelectedTranslation(t);
                              setTranslationOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedTranslation === t ? "opacity-100" : "opacity-0")} />
                            {formatTranslation(t)}
                          </CommandItem>
                        ))}
                        <CommandItem
                          value="custom"
                          onSelect={() => {
                            setSelectedTranslation("custom");
                            setTranslationOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", selectedTranslation === "custom" ? "opacity-100" : "opacity-0")} />
                          -- Custom --
                        </CommandItem>
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {selectedTranslation === "custom" && (
                <Input
                  className="mt-2"
                  placeholder="Custom translation slug"
                  value={customTranslation}
                  onChange={(e) => setCustomTranslation(e.target.value)}
                />
              )}
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

          <Button type="submit" className="w-full" disabled={loading || !!ayahError}>
            {loading ? "Ingesting..." : "Ingest Clip"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
