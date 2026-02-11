"use client";

import { ArrowUp01, ArrowDown01, Shuffle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { HomeUiSort } from "@/lib/home-ui-state";

const SORT_OPTIONS: { value: HomeUiSort; label: string; Icon: React.ElementType }[] = [
  { value: "asc", label: "Ascending", Icon: ArrowUp01 },
  { value: "desc", label: "Descending", Icon: ArrowDown01 },
  { value: "random", label: "Random", Icon: Shuffle },
];

interface SortControlProps {
  sort: HomeUiSort;
  onSortChange: (sort: HomeUiSort) => void;
}

export default function SortControl({ sort, onSortChange }: SortControlProps) {
  const current = SORT_OPTIONS.find((o) => o.value === sort) ?? SORT_OPTIONS[0];
  const CurrentIcon = current.Icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-[10px] uppercase tracking-[0.2em] font-semibold text-muted-foreground opacity-60 hover:opacity-100"
        >
          <CurrentIcon className="w-3.5 h-3.5" />
          {current.label}
          <ChevronDown className="w-3 h-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {SORT_OPTIONS.map(({ value, label, Icon }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => onSortChange(value)}
            className="gap-2 text-sm"
            data-active={sort === value}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className={sort === value ? "font-semibold" : ""}>{label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
