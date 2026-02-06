export type ClipQuality = "low" | "high";

export type ClipVariant = {
  quality: ClipQuality;
  r2Key: string;
  md5?: string;
  url?: string;
};

export type ClipTranslation = "saheeh-international" | "khan-al-hilali";

export type Clip = {
  id: string;
  surah: number;
  ayahStart: number;
  ayahEnd: number;
  reciter: string;
  riwayah?: string;
  translation?: ClipTranslation;
  variants: ClipVariant[];
};

export type ClipIndexV2 = {
  version: 2;
  generatedAt: string;
  clipCount: number;
  clipsById: Record<
    string,
    Required<Omit<Clip, "riwayah" | "translation">> & { riwayah: string; translation: ClipTranslation }
  >;
  indexes: {
    bySurah: Record<string, string[]>;
    byReciter: Record<string, string[]>;
    byRiwayah: Record<string, string[]>;
    byTranslation: Record<ClipTranslation, string[]>;
  };
};

export type ClipIndex = ClipIndexV2;
