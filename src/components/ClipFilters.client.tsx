"use client";

import { useState } from "react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { searchParamsParsers } from "@/lib/searchparams";

type Props = {
  reciters: { slug: string; name: string }[];
  riwayat: string[];
  translations: string[];
};

function toOptionalPositiveInt(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

export default function ClipFilters({ reciters, riwayat, translations }: Props) {
  const [open, setOpen] = useState(false);

  const [query, setQuery] = useQueryStates(searchParamsParsers);

  const update = (
    values: Partial<Pick<typeof query, "surah" | "start" | "end" | "reciter" | "riwayah" | "translation">>
  ) => {
    setQuery(
      (old) => ({
        ...values,
        ...(old.view === "reel" ? { clipId: null } : {}),
      }),
      { history: "replace", shallow: false, scroll: true }
    );
  };

  const reset = () => {
    setQuery(
      (old) => ({
        surah: null,
        start: null,
        end: null,
        reciter: null,
        riwayah: null,
        translation: null,
        ...(old.view === "reel" ? { clipId: null } : {}),
      }),
      { history: "replace", shallow: false, scroll: true }
    );
  };

  const form = {
    surah: query.surah ? String(query.surah) : "",
    start: query.start ? String(query.start) : "",
    end: query.end ? String(query.end) : "",
    reciter: query.reciter ?? "",
    riwayah: query.riwayah ?? "",
    translation: query.translation ?? "",
  };

  return (
    <div className="flex flex-col gap-6 p-1">
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="surah">Surah</Label>
          <Popover open={open} onOpenChange={setOpen}>
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
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
              <Command>
                <CommandInput placeholder="Search surah..." />
                <CommandList>
                  <CommandEmpty>No surah found.</CommandEmpty>
                  <CommandGroup>
                    {surahNames.map((name, index) => {
                      const num = index + 1;
                      return (
                        <CommandItem
                          key={num}
                          value={`${num} ${name}`}
                          onSelect={() => {
                            update({ surah: num });
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
              onChange={(e) => update({ start: toOptionalPositiveInt(e.target.value) })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="end">Ayah end</Label>
            <Input
              id="end"
              inputMode="numeric"
              placeholder="e.g. 7"
              value={form.end}
              onChange={(e) => update({ end: toOptionalPositiveInt(e.target.value) })}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label>Reciter</Label>
          <Select
            value={form.reciter || "all-reciters"}
            onValueChange={(v) => update({ reciter: v === "all-reciters" ? null : v })}
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
            onValueChange={(v) => update({ riwayah: v === "all-riwayah" ? null : v })}
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
              update({
                translation: v === "no-translation" ? null : (v as NonNullable<typeof query.translation>),
              })
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

      <Button variant="outline" onClick={reset} className="w-full">
        Reset Filters
      </Button>
    </div>
  );
}
