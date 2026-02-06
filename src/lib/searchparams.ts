import { createParser, createSerializer, inferParserType, parseAsString, parseAsStringLiteral } from "nuqs/server";

const parseAsPositiveInt = createParser({
  parse: (value) => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1) return null;
    return n;
  },
  serialize: String,
});

const parseAsSurahNumber = createParser({
  parse: (value) => {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 114) return null;
    return n;
  },
  serialize: String,
});

export const searchParamsParsers = {
  surah: parseAsSurahNumber,
  start: parseAsPositiveInt,
  end: parseAsPositiveInt,
  reciter: parseAsString,
  riwayah: parseAsString,
  translation: parseAsString,
  view: parseAsStringLiteral(["grid", "reel"] as const).withDefault("grid"),
  clipId: parseAsString,
} as const;

export type UrlState = inferParserType<typeof searchParamsParsers>;
export type ViewMode = UrlState["view"];

export const serialize = createSerializer(searchParamsParsers);
