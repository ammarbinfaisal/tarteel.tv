"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  DropDrawer,
  DropDrawerContent,
  DropDrawerGroup,
  DropDrawerItem,
  DropDrawerTrigger,
} from "@/components/ui/dropdrawer";
import { trackEvent } from "@/lib/analytics";
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

  const [localSurah, setLocalSurah] = useState<number | null>(value.surah);
  const [localStart, setLocalStart] = useState<number | null>(value.start);
  const [localEnd, setLocalEnd] = useState<number | null>(value.end);
  const [localReciter, setLocalReciter] = useState<string | null>(value.reciter);
  const [localRiwayah, setLocalRiwayah] = useState<string | null>(value.riwayah);
  const [localTranslation, setLocalTranslation] = useState<HomeUiFilters["translation"]>(value.translation);

  const apply = () => {
    const next: HomeUiFilters = {
      surah: localSurah,
      start: localStart,
      end: localEnd,
      reciter: localReciter,
      riwayah: localRiwayah,
      translation: localTranslation,
    };

    performance.mark("filters:apply:click");
    trackEvent("apply_filters", {
      surah_num: next.surah,
      surah_name: next.surah ? surahNames[next.surah - 1] : null,
      reciter_slug: next.reciter,
      riwayah: next.riwayah,
      translation: next.translation,
    });

    startTransition(() => {
      onApplyFilters(next);
      onApply?.();
      performance.mark("filters:apply:scheduled");
    });
  };

  const reset = () => {
    performance.mark("filters:reset:click");
    setLocalSurah(null);
    setLocalStart(null);
    setLocalEnd(null);
    setLocalReciter(null);
    setLocalRiwayah(null);
    setLocalTranslation(null);

    startTransition(() => {
      onResetFilters();
      onApply?.();
      performance.mark("filters:reset:scheduled");
    });
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
    localSurah !== value.surah ||
    localStart !== value.start ||
    localEnd !== value.end ||
    localReciter !== value.reciter ||
    localRiwayah !== value.riwayah ||
    localTranslation !== value.translation;

  return (
    <div className="flex flex-col gap-6 p-1">
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="surah">Surah</Label>
          <DropDrawer open={surahOpen} onOpenChange={setSurahOpen}>
            <DropDrawerTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={surahOpen}
                className="w-full justify-between font-normal px-3"
              >
                <span className="truncate">
                  {form.surah
                    ? `${form.surah}. ${surahNames[parseInt(form.surah, 10) - 1]}`
                    : "Select Surah..."}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </DropDrawerTrigger>
            <DropDrawerContent className="p-0">
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
                            setSurahOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              form.surah === String(num) ? "opacity-100" : "opacity-0",
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
          <DropDrawer open={reciterOpen} onOpenChange={setReciterOpen}>
            <DropDrawerTrigger asChild>
              <Button variant="outline" className="w-full justify-between font-normal px-3">
                <span className="truncate">
                  {localReciter ? reciters.find((r) => r.slug === localReciter)?.name : "All Reciters"}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </DropDrawerTrigger>
            <DropDrawerContent className="max-h-[50vh] overflow-y-auto">
              <DropDrawerGroup>
                <DropDrawerItem onSelect={() => setLocalReciter(null)}>
                  All Reciters
                </DropDrawerItem>
                {reciters.map((r) => (
                  <DropDrawerItem key={r.slug} onSelect={() => setLocalReciter(r.slug)}>
                    {r.name}
                  </DropDrawerItem>
                ))}
              </DropDrawerGroup>
            </DropDrawerContent>
          </DropDrawer>
        </div>

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
    props.value.surah ?? "",
    props.value.start ?? "",
    props.value.end ?? "",
    props.value.reciter ?? "",
    props.value.riwayah ?? "",
    props.value.translation ?? "",
  ].join("|");

  return <ClipFiltersForm key={key} {...props} />;
}
