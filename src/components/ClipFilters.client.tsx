"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

type Props = {
  reciters: { slug: string; name: string }[];
  riwayat: string[];
  translations: string[];
};

function toParam(v: string) {
  const t = v.trim();
  return t ? t : null;
}

export default function ClipFilters({ reciters, riwayat, translations }: Props) {
  const router = useRouter();
  const sp = useSearchParams();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const initial = useMemo(
    () => ({
      surah: sp.get("surah") ?? "",
      start: sp.get("start") ?? "",
      end: sp.get("end") ?? "",
      reciter: sp.get("reciter") ?? "",
      riwayah: sp.get("riwayah") ?? "",
      translation: sp.get("translation") ?? ""
    }),
    [sp]
  );

  const [form, setForm] = useState(initial);

  useEffect(() => {
    setForm(initial);
  }, [initial]);

  function apply(next: typeof form) {
    const params = new URLSearchParams();
    const surah = toParam(next.surah);
    const start = toParam(next.start);
    const end = toParam(next.end);
    const reciter = toParam(next.reciter);
    const riwayah = toParam(next.riwayah);
    const translation = toParam(next.translation);

    if (surah) params.set("surah", surah);
    if (start) params.set("start", start);
    if (end) params.set("end", end);
    if (reciter) params.set("reciter", reciter);
    if (riwayah) params.set("riwayah", riwayah);
    if (translation) params.set("translation", translation);

    // Preserve view mode
    const view = sp.get("view");
    if (view) params.set("view", view);

    const qs = params.toString();
    startTransition(() => router.replace(qs ? `/?${qs}` : "/"));
  }

  function update<K extends keyof typeof form>(key: K, value: string) {
    let finalValue = value;
    if (value === "all-reciters" || value === "all-riwayah" || value === "no-translation") {
      finalValue = "";
    }
    const next = { ...form, [key]: finalValue };
    setForm(next);
    apply(next);
  }

  function reset() {
    const next = { surah: "", start: "", end: "", reciter: "", riwayah: "", translation: "" };
    setForm(next);
    
    const params = new URLSearchParams();
    const view = sp.get("view");
    if (view) params.set("view", view);
    
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `/?${qs}` : "/"));
  }

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
                            update("surah", String(num));
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
              onChange={(e) => update("start", e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="end">Ayah end</Label>
            <Input
              id="end"
              inputMode="numeric"
              placeholder="e.g. 7"
              value={form.end}
              onChange={(e) => update("end", e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label>Reciter</Label>
          <Select value={form.reciter || "all-reciters"} onValueChange={(v) => update("reciter", v)}>
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
          <Select value={form.riwayah || "all-riwayah"} onValueChange={(v) => update("riwayah", v)}>
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
          <Select value={form.translation || "no-translation"} onValueChange={(v) => update("translation", v)}>
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
