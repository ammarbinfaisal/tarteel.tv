import DownloadsReelPage from "@/components/DownloadsReelPage.client";
import { Suspense } from "react";

export default function DownloadsReel() {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-black flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
    </div>}>
      <DownloadsReelPage />
    </Suspense>
  );
}

