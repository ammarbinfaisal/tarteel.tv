import { notFound } from "next/navigation";

import { getClipById, listReciters, listRiwayat, listTranslations } from "@/lib/server/clips";
import { requireAdminPageAuth } from "@/lib/server/admin-auth";

import AdminLogoutButton from "../../../AdminLogoutButton.client";
import ClipMetadataEditor from "../../ClipMetadataEditor.client";

type PageProps = {
  params: Promise<{ clipId: string }>;
};

export const metadata = {
  title: "Edit Clip | Admin",
};

export default async function ClipEditorPage({ params }: PageProps) {
  const { clipId } = await params;
  const decodedClipId = decodeURIComponent(clipId);

  await requireAdminPageAuth(`/admin/clips/clip/${clipId}`);

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
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-4 flex justify-end">
        <AdminLogoutButton />
      </div>
      <ClipMetadataEditor
        clip={clip}
        reciters={reciters}
        riwayat={riwayat}
        translations={translations}
      />
    </div>
  );
}
