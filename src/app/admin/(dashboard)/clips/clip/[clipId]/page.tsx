import { notFound } from "next/navigation";

import { getClipById, listReciters, listRiwayat, listTranslations } from "@/lib/server/clips";

import ClipMetadataEditor from "../../ClipMetadataEditor.client";

type PageProps = {
  params: Promise<{ clipId: string }>;
};

export const metadata = {
  title: "Edit Clip",
};

export default async function ClipEditorPage({ params }: PageProps) {
  const { clipId } = await params;
  const decodedClipId = decodeURIComponent(clipId);

  const [clip, reciters, riwayat, translations] = await Promise.all([
    getClipById(decodedClipId),
    listReciters(),
    listRiwayat(),
    listTranslations(),
  ]);

  if (!clip) {
    notFound();
  }

  return (
    <ClipMetadataEditor
      clip={clip}
      reciters={reciters}
      riwayat={riwayat}
      translations={translations}
    />
  );
}
