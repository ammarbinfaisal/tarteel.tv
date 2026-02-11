export type ClipQuality = "hls" | "low" | "1" | "2" | "3" | "high" | "4" | "thumbnail";

export type ClipVariant = {
  quality: ClipQuality;
  r2Key: string;
  md5?: string;
  url?: string;
};

export type ClipTranslation = "saheeh-international" | "khan-al-hilali" | "abu-iyaad" | (string & {});

export type Clip = {
  id: string;
  surah: number;
  ayahStart: number;
  ayahEnd: number;
  reciterSlug: string;
  reciterName: string;
  riwayah?: string;
  translation?: ClipTranslation;
  thumbnailBlur?: string;
  variants: ClipVariant[];
  isPartial?: boolean;
};

export type ClipIndexV3 = {
  version: 3;
  generatedAt: string;
  clipCount: number;
  clipsById: Record<
    string,
    Required<Omit<Clip, "riwayah" | "translation">> & { riwayah: string; translation: ClipTranslation }
  >;
  indexes: {
    bySurah: Record<string, string[]>;
    byReciterSlug: Record<string, string[]>;
    byRiwayah: Record<string, string[]>;
    byTranslation: Record<ClipTranslation, string[]>;
  };
};

export type ClipIndex = ClipIndexV3;
