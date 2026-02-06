import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import AudioPlayer from "@/components/AudioPlayer.client";
import { getClipById } from "@/lib/server/clips";
import { variantToPublicUrl } from "@/lib/server/r2";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatSlug, formatTranslation } from "@/lib/utils";

export default async function ClipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const clipRaw = await getClipById(id);
  if (!clipRaw) notFound();
  
  const clip = {
    ...clipRaw,
    variants: clipRaw.variants.map((v) => ({ ...v, url: v.url ?? variantToPublicUrl(v) ?? undefined }))
  };
  const variants = clip.variants;

  return (
    <div className="py-6 flex flex-col gap-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="rounded-full">
          <Link href="/">
            <ChevronLeft className="h-6 w-6" />
            <span className="sr-only">Back</span>
          </Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Clip Details</h1>
      </div>

      <Card className="border-none bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-3xl">
            Surah {clip.surah} · Ayah {clip.ayahStart}-{clip.ayahEnd}
          </CardTitle>
          <p className="text-muted-foreground text-lg">
            {formatSlug(clip.reciter)} · {formatSlug(clip.riwayah)}
            {clip.translation ? ` · ${formatTranslation(clip.translation)}` : null}
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <AudioPlayer clipId={clip.id} variants={variants} />
          
          <div className="rounded-lg bg-muted p-4 text-xs text-muted-foreground italic">
            Note: If media fails to load, verify your R2 configuration and public URL settings.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
