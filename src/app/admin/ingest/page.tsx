import { listReciters, listRiwayat, listTranslations } from "@/lib/server/clips";
import IngestForm from "./IngestForm.client";

export const metadata = {
  title: "Ingest Clip | Admin",
};

export default async function IngestPage() {
  const [reciters, riwayat, translations] = await Promise.all([
    listReciters(),
    listRiwayat(),
    listTranslations(),
  ]);

  return (
    <div className="py-10 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Ingest New Clip</h1>
      <IngestForm 
        reciters={reciters} 
        riwayat={riwayat} 
        translations={translations}
      />
    </div>
  );
}
