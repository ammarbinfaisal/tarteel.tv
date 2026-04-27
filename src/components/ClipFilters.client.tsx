"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatSlug, formatTranslation, surahNames } from "@/lib/utils";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  DropDrawer,
  DropDrawerContent,
  DropDrawerTrigger,
} from "@/components/ui/dropdrawer";
import type { HomeUiFilters } from "@/lib/home-ui-state";
import type { ClipTranslation } from "@/lib/types";

type Props = {
  reciters: { slug: string; name: string }[];
  riwayat: string[];
  translations: string[];
  value: HomeUiFilters;
  onApplyFilters: (next: HomeUiFilters) => void;
  onResetFilters: () => void;
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

function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function ClipFiltersForm({
  reciters,
  riwayat,
  translations,
  value,
  onApplyFilters,
  onResetFilters,
  onApply,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [surahOpen, setSurahOpen] = useState(false);
  const [reciterOpen, setReciterOpen] = useState(false);
  const [riwayahOpen, setRiwayahOpen] = useState(false);
  const [translationOpen, setTranslationOpen] = useState(false);

  const [localSurahs, setLocalSurahs] = useState<number[]>(value.surahs);
  const [localStart, setLocalStart] = useState<number | null>(value.start);
  const [localEnd, setLocalEnd] = useState<number | null>(value.end);
  const [localReciters, setLocalReciters] = useState<string[]>(value.reciters);
  const [localRiwayahs, setLocalRiwayahs] = useState<string[]>(value.riwayahs);
  const [localTranslations, setLocalTranslations] = useState<HomeUiFilters["translations"]>(value.translations);

  const multiSurah = localSurahs.length > 1;

  const apply = () => {
    const next: HomeUiFilters = {
      surahs: localSurahs,
      start: multiSurah ? null : localStart,
      end: multiSurah ? null : localEnd,
      reciters: localReciters,
      riwayahs: localRiwayahs,
      translations: localTranslations,
    };

    performance.mark("filters:apply:click");

    startTransition(() => {
      onApplyFilters(next);
      onApply?.();
      performance.mark("filters:apply:scheduled");
    });
  };

  const reset = () => {
    performance.mark("filters:reset:click");
    setLocalSurahs([]);
    setLocalStart(null);
    setLocalEnd(null);
    setLocalReciters([]);
    setLocalRiwayahs([]);
    setLocalTranslations([]);

    startTransition(() => {
      onResetFilters();
      onApply?.();
      performance.mark("filters:reset:scheduled");
    });
  };

  const hasChanges =
    !arraysEqual(localSurahs, value.surahs) ||
    localStart !== value.start ||
    localEnd !== value.end ||
    !arraysEqual(localReciters, value.reciters) ||
    !arraysEqual(localRiwayahs, value.riwayahs) ||
    !arraysEqual(localTranslations, value.translations);

  const surahLabel =
    localSurahs.length === 0
      ? "All Surahs"
      : localSurahs.length === 1
        ? `${localSurahs[0]}. ${surahNames[localSurahs[0] - 1]}`
        : `${localSurahs.length} surahs selected`;

  const reciterLabel =
    localReciters.length === 0
      ? "All Reciters"
      : localReciters.length === 1
        ? reciters.find((r) => r.slug === localReciters[0])?.name ?? localReciters[0]
        : `${localReciters.length} reciters selected`;

  return (
    <div className="flex flex-col gap-6 p-1">
      {/* Surah Selection */}
      <div className="grid gap-3">
        <Label>Surah</Label>
        <DropDrawer open={surahOpen} onOpenChange={setSurahOpen}>
          <DropDrawerTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={surahOpen}
              className="w-full justify-between font-normal px-3"
            >
              <span className="truncate">{surahLabel}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </DropDrawerTrigger>
          <DropDrawerContent className="p-0">
            <Command title="Surah search">
              <CommandInput
                placeholder="Search surah..."
                autoFocus={false}
                onPointerDown={(e) => e.stopPropagation()}
              />
              <CommandList className="max-h-[40vh] sm:max-h-[300px]">
                <CommandEmpty>No surah found.</CommandEmpty>
                <CommandGroup>
                  {surahNames.map((name, index) => {
                    const num = index + 1;
                    const isSelected = localSurahs.includes(num);
                    return (
                      <CommandItem
                        key={num}
                        value={`${num} ${name}`}
                        onSelect={() => {
                          setLocalSurahs((prev) =>
                            isSelected
                              ? prev.filter((s) => s !== num)
                              : [...prev, num].sort((a, b) => a - b),
                          );
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            isSelected ? "opacity-100" : "opacity-0",
                          )}
                        />
                        {num}. {name}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </DropDrawerContent>
        </DropDrawer>

        {localSurahs.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {localSurahs.map((num) => (
              <span
                key={num}
                className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-primary/10 text-xs font-medium"
              >
                {num}. {surahNames[num - 1]}
                <button
                  type="button"
                  className="rounded-full p-1 hover:bg-primary/20"
                  onClick={() => setLocalSurahs((prev) => prev.filter((s) => s !== num))}
                >
                  <X className="h-4 w-4" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Ayah Range */}
      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="start">Ayah start</Label>
            <Input
              id="start"
              inputMode="numeric"
              placeholder="e.g. 1"
              disabled={multiSurah}
              value={multiSurah ? "" : (localStart ? String(localStart) : "")}
              onChange={(e) => setLocalStart(toOptionalPositiveInt(e.target.value))}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="end">Ayah end</Label>
            <Input
              id="end"
              inputMode="numeric"
              placeholder="e.g. 7"
              disabled={multiSurah}
              value={multiSurah ? "" : (localEnd ? String(localEnd) : "")}
              onChange={(e) => setLocalEnd(toOptionalPositiveInt(e.target.value))}
            />
          </div>
        </div>
        {multiSurah && (
          <p className="text-xs text-muted-foreground">
            Ayah range is not available when multiple surahs are selected.
          </p>
        )}
      </div>

      {/* Reciter Selection */}
      <div className="grid gap-3">
        <Label>Reciter</Label>
        <DropDrawer open={reciterOpen} onOpenChange={setReciterOpen}>
          <DropDrawerTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={reciterOpen}
              className="w-full justify-between font-normal px-3"
            >
              <span className="truncate">{reciterLabel}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </DropDrawerTrigger>
          <DropDrawerContent className="p-0">
            <Command title="Reciter search">
              <CommandInput
                placeholder="Search reciter..."
                autoFocus={false}
                onPointerDown={(e) => e.stopPropagation()}
              />
              <CommandList className="max-h-[40vh] sm:max-h-[300px]">
                <CommandEmpty>No reciter found.</CommandEmpty>
                <CommandGroup>
                  {reciters.map((r) => {
                    const isSelected = localReciters.includes(r.slug);
                    return (
                      <CommandItem
                        key={r.slug}
                        value={r.name}
                        onSelect={() => {
                          setLocalReciters((prev) =>
                            isSelected
                              ? prev.filter((s) => s !== r.slug)
                              : [...prev, r.slug],
                          );
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            isSelected ? "opacity-100" : "opacity-0",
                          )}
                        />
                        {r.name}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </DropDrawerContent>
        </DropDrawer>

        {localReciters.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {localReciters.map((slug) => {
              const name = reciters.find((r) => r.slug === slug)?.name ?? slug;
              return (
                <span
                  key={slug}
                  className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-primary/10 text-xs font-medium"
                >
                  {name}
                  <button
                    type="button"
                    className="rounded-full p-1 hover:bg-primary/20"
                    onClick={() => setLocalReciters((prev) => prev.filter((s) => s !== slug))}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Riwayah */}
      <div className="grid gap-3">
        <Label>Riwayah</Label>
        <DropDrawer open={riwayahOpen} onOpenChange={setRiwayahOpen}>
          <DropDrawerTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={riwayahOpen}
              className="w-full justify-between font-normal px-3"
            >
              <span className="truncate">
                {localRiwayahs.length === 0
                  ? "All Riwayah"
                  : localRiwayahs.length === 1
                    ? formatSlug(localRiwayahs[0])
                    : `${localRiwayahs.length} riwayat selected`}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </DropDrawerTrigger>
          <DropDrawerContent className="p-0">
            <Command title="Riwayah search">
              <CommandInput
                placeholder="Search riwayah..."
                autoFocus={false}
                onPointerDown={(e) => e.stopPropagation()}
              />
              <CommandList className="max-h-[40vh] sm:max-h-[300px]">
                <CommandEmpty>No riwayah found.</CommandEmpty>
                <CommandGroup>
                  {riwayat.map((r) => {
                    const isSelected = localRiwayahs.includes(r);
                    return (
                      <CommandItem
                        key={r}
                        value={formatSlug(r)}
                        onSelect={() => {
                          setLocalRiwayahs((prev) =>
                            isSelected ? prev.filter((x) => x !== r) : [...prev, r],
                          );
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            isSelected ? "opacity-100" : "opacity-0",
                          )}
                        />
                        {formatSlug(r)}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </DropDrawerContent>
        </DropDrawer>

        {localRiwayahs.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {localRiwayahs.map((r) => (
              <span
                key={r}
                className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-primary/10 text-xs font-medium"
              >
                {formatSlug(r)}
                <button
                  type="button"
                  className="rounded-full p-1 hover:bg-primary/20"
                  onClick={() => setLocalRiwayahs((prev) => prev.filter((x) => x !== r))}
                >
                  <X className="h-4 w-4" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Translation */}
      <div className="grid gap-3">
        <Label>Translation</Label>
        <DropDrawer open={translationOpen} onOpenChange={setTranslationOpen}>
          <DropDrawerTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={translationOpen}
              className="w-full justify-between font-normal px-3"
            >
              <span className="truncate">
                {localTranslations.length === 0
                  ? "No Translation"
                  : localTranslations.length === 1
                    ? formatTranslation(localTranslations[0])
                    : `${localTranslations.length} translations selected`}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </DropDrawerTrigger>
          <DropDrawerContent className="p-0">
            <Command title="Translation search">
              <CommandInput
                placeholder="Search translation..."
                autoFocus={false}
                onPointerDown={(e) => e.stopPropagation()}
              />
              <CommandList className="max-h-[40vh] sm:max-h-[300px]">
                <CommandEmpty>No translation found.</CommandEmpty>
                <CommandGroup>
                  {translations.map((t) => {
                    const isSelected = localTranslations.includes(t);
                    return (
                      <CommandItem
                        key={t}
                        value={formatTranslation(t)}
                        onSelect={() => {
                          setLocalTranslations((prev) =>
                            isSelected
                              ? prev.filter((x) => x !== t)
                              : ([...prev, t] as ClipTranslation[]),
                          );
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            isSelected ? "opacity-100" : "opacity-0",
                          )}
                        />
                        {formatTranslation(t)}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </DropDrawerContent>
        </DropDrawer>

        {localTranslations.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {localTranslations.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-primary/10 text-xs font-medium"
              >
                {formatTranslation(t)}
                <button
                  type="button"
                  className="rounded-full p-1 hover:bg-primary/20"
                  onClick={() => setLocalTranslations((prev) => prev.filter((x) => x !== t))}
                >
                  <X className="h-4 w-4" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Button data-testid="filters-apply" onClick={apply} className="w-full" disabled={!hasChanges || isPending}>
          Apply Filters
        </Button>
        <Button data-testid="filters-reset" variant="outline" onClick={reset} className="w-full" disabled={isPending}>
          Reset Filters
        </Button>
      </div>
    </div>
  );
}

export default function ClipFilters(props: Props) {
  const key = [
    props.value.surahs.join(","),
    props.value.start ?? "",
    props.value.end ?? "",
    props.value.reciters.join(","),
    props.value.riwayahs.join(","),
    props.value.translations.join(","),
  ].join("|");

  return <ClipFiltersForm key={key} {...props} />;
}
