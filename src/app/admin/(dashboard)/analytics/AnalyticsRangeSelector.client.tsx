"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";

const ranges = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "all", label: "All Time" },
] as const;

export default function AnalyticsRangeSelector({ current }: { current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handleSelect(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", key);
    router.push(`${pathname}?${params.toString()}` as any);
  }

  return (
    <div className="flex gap-1">
      {ranges.map(({ key, label }) => (
        <Button
          key={key}
          size="sm"
          variant={current === key ? "default" : "outline"}
          onClick={() => handleSelect(key)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
