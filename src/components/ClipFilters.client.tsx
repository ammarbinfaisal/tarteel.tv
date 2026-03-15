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
  DropDrawerGroup,
  DropDrawerItem,
  DropDrawerTrigger,
} from "@/components/ui/dropdrawer";
import type { HomeUiFilters } from "@/lib/home-ui-state";

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
  const [localRiwayah, setLocalRiwayah] = useState<string | null>(value.riwayah);
  const [localTranslation, setLocalTranslation] = useState<HomeUiFilters["translation"]>(value.translation);

  const multiSurah = localSurahs.length > 1;

  const apply = () => {
    const next: HomeUiFilters = {
      surahs: localSurahs,
      start: multiSurah ? null : localStart,
      end: multiSurah ? null : localEnd,
      reciters: localReciters,
      riwayah: localRiwayah,
      translation: localTranslation,
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
    setLocalRiwayah(null);
    setLocalTranslation(null);

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
    localRiwayah !== value.riwayah ||
    localTranslation !== value.translation;

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
                  className="rounded-full p-0.5 hover:bg-primary/20"
                  onClick={() => setLocalSurahs((prev) => prev.filter((s) => s !== num))}
                >
                  <X className="h-3 w-3" />
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
                    className="rounded-full p-0.5 hover:bg-primary/20"
                    onClick={() => setLocalReciters((prev) => prev.filter((s) => s !== slug))}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Riwayah */}
      <div className="grid gap-2">
        <Label>Riwayah</Label>
        <DropDrawer open={riwayahOpen} onOpenChange={setRiwayahOpen}>
          <DropDrawerTrigger asChild>
            <Button variant="outline" className="w-full justify-between font-normal px-3">
              <span className="truncate">
                {localRiwayah ? formatSlug(localRiwayah) : "All Riwayah"}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </DropDrawerTrigger>
          <DropDrawerContent className="max-h-[50vh] overflow-y-auto">
            <DropDrawerGroup>
              <DropDrawerItem onSelect={() => setLocalRiwayah(null)}>
                All Riwayah
              </DropDrawerItem>
              {riwayat.map((r) => (
                <DropDrawerItem key={r} onSelect={() => setLocalRiwayah(r)}>
                  {formatSlug(r)}
                </DropDrawerItem>
              ))}
            </DropDrawerGroup>
          </DropDrawerContent>
        </DropDrawer>
      </div>

      {/* Translation */}
      <div className="grid gap-2">
        <Label>Translation</Label>
        <DropDrawer open={translationOpen} onOpenChange={setTranslationOpen}>
          <DropDrawerTrigger asChild>
            <Button variant="outline" className="w-full justify-between font-normal px-3">
              <span className="truncate">
                {localTranslation ? formatTranslation(localTranslation) : "No Translation"}
              </span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </DropDrawerTrigger>
          <DropDrawerContent className="max-h-[50vh] overflow-y-auto">
            <DropDrawerGroup>
              <DropDrawerItem onSelect={() => setLocalTranslation(null)}>
                No Translation
              </DropDrawerItem>
              {translations.map((t) => (
                <DropDrawerItem key={t} onSelect={() => setLocalTranslation(t)}>
                  {formatTranslation(t)}
                </DropDrawerItem>
              ))}
            </DropDrawerGroup>
          </DropDrawerContent>
        </DropDrawer>
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
    props.value.riwayah ?? "",
    props.value.translation ?? "",
  ].join("|");

  return <ClipFiltersForm key={key} {...props} />;
}
