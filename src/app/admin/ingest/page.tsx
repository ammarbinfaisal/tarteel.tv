import { listReciters, listRiwayat, listTranslations } from "@/lib/server/clips";
import { requireAdminPageAuth } from "@/lib/server/admin-auth";

import AdminLogoutButton from "../AdminLogoutButton.client";
import IngestForm from "./IngestForm.client";

export const metadata = {
  title: "Ingest Clip | Admin",
};

export default async function IngestPage() {
  await requireAdminPageAuth("/admin/ingest");

  const [reciters, riwayat, translations] = await Promise.all([
    listReciters(),
    listRiwayat(),
    listTranslations(),
  ]);

  const ingestEndpoint =
    process.env.INGEST_ENDPOINT ??
    process.env.NEXT_PUBLIC_INGEST_ENDPOINT ??
    "http://localhost:3001/ingest";

  const telegramMaxUploadMbRaw = process.env.TELEGRAM_MAX_UPLOAD_MB ?? "50";
  const telegramMaxUploadMb = Number(telegramMaxUploadMbRaw);

  return (
    <div className="py-10 max-w-2xl mx-auto">
      <div className="mb-8 flex items-start justify-between gap-4">
        <h1 className="text-3xl font-bold">Ingest New Clip</h1>
        <AdminLogoutButton />
      </div>
      <IngestForm
        reciters={reciters}
        riwayat={riwayat}
        translations={translations}
        ingestEndpoint={ingestEndpoint}
        telegramMaxUploadMb={Number.isFinite(telegramMaxUploadMb) && telegramMaxUploadMb > 0 ? telegramMaxUploadMb : null}
      />
    </div>
  );
}
