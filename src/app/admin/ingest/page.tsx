import { headers } from "next/headers";
import { listReciters, listRiwayat, listTranslations } from "@/lib/server/clips";
import IngestForm from "./IngestForm.client";

export const metadata = {
  title: "Ingest Clip | Admin",
};

export default async function IngestPage() {
  const [reciters, riwayat, translations, headersList] = await Promise.all([
    listReciters(),
    listRiwayat(),
    listTranslations(),
    headers(),
  ]);

  const authHeader = headersList.get("authorization") ?? "";
  const ingestEndpoint =
    process.env.INGEST_ENDPOINT ??
    process.env.NEXT_PUBLIC_INGEST_ENDPOINT ??
    "http://localhost:3001/ingest";

  return (
    <div className="py-10 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Ingest New Clip</h1>
      <IngestForm
        reciters={reciters}
        riwayat={riwayat}
        translations={translations}
        authHeader={authHeader}
        ingestEndpoint={ingestEndpoint}
      />
    </div>
  );
}
