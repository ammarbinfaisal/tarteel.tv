import { listReciters, listRiwayat, listTranslations } from "@/lib/server/clips";

import IngestForm from "./IngestForm.client";

export const metadata = {
  title: "Ingest Clip",
};

export default async function IngestPage() {
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
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Ingest New Clip</h1>
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
