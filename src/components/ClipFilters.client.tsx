"use client";

import { useState, useEffect } from "react";
import { useQueryStates } from "nuqs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { formatSlug, formatTranslation, surahNames } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { searchParamsParsers, type UrlState } from "@/lib/searchparams";
import { trackEvent } from "@/lib/analytics";

type Props = {
  reciters: { slug: string; name: string }[];
  riwayat: string[];
  translations: string[];
  onApply?: () => void;
};

function toOptionalPositiveInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

export default function ClipFilters({ reciters, riwayat, translations, onApply }: Props) {
  const [open, setOpen] = useState(false);

  const [query, setQuery] = useQueryStates(searchParamsParsers);

  // Local state for the form
  const [localSurah, setLocalSurah] = useState<number | null>(query.surah);
  const [localStart, setLocalStart] = useState<number | null>(query.start);
  const [localEnd, setLocalEnd] = useState<number | null>(query.end);
  const [localReciter, setLocalReciter] = useState<string | null>(query.reciter);
  const [localRiwayah, setLocalRiwayah] = useState<string | null>(query.riwayah);
  const [localTranslation, setLocalTranslation] = useState<UrlState["translation"]>(query.translation);

  // Sync local state when query changes from outside (e.g. reset)
  useEffect(() => {
    setLocalSurah(query.surah);
    setLocalStart(query.start);
    setLocalEnd(query.end);
    setLocalReciter(query.reciter);
    setLocalRiwayah(query.riwayah);
    setLocalTranslation(query.translation);
  }, [query.surah, query.start, query.end, query.reciter, query.riwayah, query.translation]);

  const apply = () => {
    trackEvent('apply_filters', {
      surah_num: localSurah,
      surah_name: localSurah ? surahNames[localSurah - 1] : null,
      reciter_slug: localReciter,
      riwayah: localRiwayah,
      translation: localTranslation,
    });

    setQuery(
      (old) => ({
        ...old,
        surah: localSurah,
        start: localStart,
        end: localEnd,
        reciter: localReciter,
        riwayah: localRiwayah,
        translation: localTranslation,
      }),
      { history: "replace", shallow: false, scroll: true }
    );
    onApply?.();
  };

  const reset = () => {
    setLocalSurah(null);
    setLocalStart(null);
    setLocalEnd(null);
    setLocalReciter(null);
    setLocalRiwayah(null);
    setLocalTranslation(null);

    setQuery(
      (old) => ({
        ...old,
        surah: null,
        start: null,
        end: null,
        reciter: null,
        riwayah: null,
        translation: null,
      }),
      { history: "replace", shallow: false, scroll: true }
    );
    onApply?.();
  };

  const form = {
    surah: localSurah ? String(localSurah) : "",
    start: localStart ? String(localStart) : "",
    end: localEnd ? String(localEnd) : "",
    reciter: localReciter ?? "",
    riwayah: localRiwayah ?? "",
    translation: localTranslation ?? "",
  };

  const hasChanges = 
    localSurah !== query.surah ||
    localStart !== query.start ||
    localEnd !== query.end ||
    localReciter !== query.reciter ||
    localRiwayah !== query.riwayah ||
    localTranslation !== query.translation;

  return (
    <div className="flex flex-col gap-6 p-1">
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="surah">Surah</Label>
          <Popover open={open} onOpenChange={setOpen} modal={false}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full justify-between font-normal"
              >
                {form.surah
                  ? `${form.surah}. ${surahNames[parseInt(form.surah) - 1]}`
                  : "Select Surah..."}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent 
              className="w-[calc(100vw-3rem)] sm:w-[var(--radix-popover-trigger-width)] p-0" 
              align="start"
            >
              <Command title="Surah search">
                <CommandInput 
                  placeholder="Search surah..." 
                  onPointerDown={(e) => e.stopPropagation()}
                />
                <CommandList className="max-h-[40vh] sm:max-h-[300px]">
                  <CommandEmpty>No surah found.</CommandEmpty>
                  <CommandGroup>
                    {surahNames.map((name, index) => {
                      const num = index + 1;
                      return (
                        <CommandItem
                          key={num}
                          value={`${num} ${name}`}
                          onSelect={() => {
                            setLocalSurah(num);
                            setOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              form.surah === String(num) ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {num}. {name}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="start">Ayah start</Label>
            <Input
              id="start"
              inputMode="numeric"
              placeholder="e.g. 1"
              value={form.start}
              onChange={(e) => setLocalStart(toOptionalPositiveInt(e.target.value))}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="end">Ayah end</Label>
            <Input
              id="end"
              inputMode="numeric"
              placeholder="e.g. 7"
              value={form.end}
              onChange={(e) => setLocalEnd(toOptionalPositiveInt(e.target.value))}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label>Reciter</Label>
          <Select
            value={form.reciter || "all-reciters"}
            onValueChange={(v) => setLocalReciter(v === "all-reciters" ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Reciters" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-reciters">All Reciters</SelectItem>
              {reciters.map((r) => (
                <SelectItem key={r.slug} value={r.slug}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label>Riwayah</Label>
          <Select
            value={form.riwayah || "all-riwayah"}
            onValueChange={(v) => setLocalRiwayah(v === "all-riwayah" ? null : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Riwayah" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-riwayah">All Riwayah</SelectItem>
              {riwayat.map((r) => (
                <SelectItem key={r} value={r}>
                  {formatSlug(r)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label>Translation</Label>
          <Select
            value={form.translation || "no-translation"}
            onValueChange={(v) =>
              setLocalTranslation(v === "no-translation" ? null : (v as UrlState["translation"]))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="No Translation" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="no-translation">No Translation</SelectItem>
              {translations.map((t) => (
                <SelectItem key={t} value={t}>
                  {formatTranslation(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Button onClick={apply} className="w-full" disabled={!hasChanges}>
          Apply Filters
        </Button>
        <Button variant="outline" onClick={reset} className="w-full">
          Reset Filters
        </Button>
      </div>
    </div>
  );
}
