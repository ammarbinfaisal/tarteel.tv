import type { Clip } from "@/lib/types";
import ClipCard from "@/components/ClipCard";
import { cn } from "@/lib/utils";
import ReelList from "./ReelList.client";

interface ClipListProps {
  clips: Clip[];
  view: "grid" | "reel";
  filterData: {
    reciters: { slug: string; name: string }[];
    riwayat: string[];
    translations: string[];
  };
}

export default function ClipList({ clips, view, filterData }: ClipListProps) {
  if (clips.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        No clips match these filters.
      </div>
    );
  }

  if (view === "reel") {
    return <ReelList clips={clips} filterData={filterData} />;
  }

  return (
    <div className={cn(
      "grid gap-0.5",
      view === "grid" ? "grid-cols-3" : "flex flex-col max-w-2xl mx-auto w-full gap-8"
    )}>
      {clips.map((c) => (
        <ClipCard key={c.id} clip={c} />
      ))}
    </div>
  );
}
