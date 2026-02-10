import type { Clip } from "@/lib/types";
import ClipCard from "@/components/ClipCard";
import { cn } from "@/lib/utils";
import ReelList, { FilterSheet } from "./ReelList.client";
import { SearchX } from "lucide-react";
import { Button } from "./ui/button";

interface ClipListProps {
  clips: Clip[];
  view: "grid" | "reel";
  filterData: {
    reciters: { slug: string; name: string }[];
    riwayat: string[];
    translations: string[];
  };
  isOffline?: boolean;
}

export default function ClipList({ clips, view, filterData, isOffline = false }: ClipListProps) {
  if (clips.length === 0) {
    if (view === "reel") {
      return (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center p-6 text-center z-30">
          <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-8 border border-white/10 flex flex-col items-center gap-4 max-w-sm">
            <SearchX className="w-12 h-12 text-white/20" />
            <div className="space-y-2">
              <h3 className="text-white font-semibold text-lg">No recitations found</h3>
              <p className="text-white/50 text-sm">
                We couldn&apos;t find any clips matching your current filters. Try adjusting your criteria.
              </p>
            </div>
            <div className="mt-4 pointer-events-auto">
              <FilterSheet 
                filterData={filterData} 
                trigger={
                  <Button className="rounded-full px-8 bg-white text-black hover:bg-white/90 font-bold">
                    Refine Filters
                  </Button>
                }
              />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-4">
        <SearchX className="w-12 h-12 opacity-20" />
        <p>No clips match these filters. Try broadening your search.</p>
      </div>
    );
  }

  if (view === "reel") {
    return <ReelList clips={clips} filterData={filterData} isOffline={isOffline} />;
  }

  return (
    <div className={cn(
      "grid gap-px",
      view === "grid" ? "grid-cols-3 md:max-w-2xl md:mx-auto w-full" : "flex flex-col max-w-2xl mx-auto w-full gap-8"
    )}>
      {clips.map((c) => (
        <ClipCard key={c.id} clip={c} />
      ))}
    </div>
  );
}
