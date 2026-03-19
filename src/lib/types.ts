export type ClipQuality =
  | "hls"
  | "low"
  | "1"
  | "2"
  | "3"
  | "high"
  | "4"
  | "thumbnail"
  | "offline"
  | (string & {});

export type ClipVariant = {
  quality: ClipQuality;
  r2Key: string;
  md5?: string;
  url?: string;
};

export type ClipTranslation = "saheeh-international" | "khan-al-hilali" | "abu-iyaad" | (string & {});

export type TelegramPost = {
  messageId: number;
  chatId: number;
  channelUsername?: string;
  channelTitle?: string;
  url?: string;
  postedAt?: string;
};

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
  telegram?: TelegramPost;
  variants: ClipVariant[];
  isPartial?: boolean;
  createdAt?: Date;
};

export type ClipIndexV3 = {
  version: 3;
  generatedAt: string;
  clipCount: number;
  clipsById: Record<
    string,
    Required<Omit<Clip, "riwayah" | "translation" | "telegram">> & { riwayah: string; translation: ClipTranslation }
  >;
  indexes: {
    bySurah: Record<string, string[]>;
    byReciterSlug: Record<string, string[]>;
    byRiwayah: Record<string, string[]>;
    byTranslation: Record<ClipTranslation, string[]>;
  };
};

export type ClipIndex = ClipIndexV3;
