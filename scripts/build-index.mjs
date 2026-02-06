import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";

const DATA_DIR = path.join(process.cwd(), "data");
const JSONL_PATH = path.join(DATA_DIR, "clips.jsonl");
const INDEX_PATH = path.join(DATA_DIR, "clips.index.json");

function isPositiveInt(value) {
  return Number.isInteger(value) && value > 0;
}

function slugify(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeReciterName(value) {
  const raw = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!raw) return "";

  const canonicalBySlug = {
    maher: "Maher al-Mu'aiqly",
    "maher-al-muaiqly": "Maher al-Mu'aiqly",
    "maher-al-mu-aiqly": "Maher al-Mu'aiqly",
    "maher-al-mu-aiqlee": "Maher al-Mu'aiqly",
    "maher-al-mu-aiqli": "Maher al-Mu'aiqly"
  };

  // If the input already matches a canonical spelling (including apostrophes), keep it.
  for (const [, canonical] of Object.entries(canonicalBySlug)) {
    if (raw === canonical) return canonical;
  }

  const tokens = raw.split(" ").map((token) => {
    const parts = token.split("-").filter(Boolean);
    const normalizedParts = parts.map((part) => {
      const lower = part.toLowerCase();
      if (lower === "al") return "al";
      const cleaned = lower;
      const firstAlpha = cleaned.search(/[a-z]/i);
      if (firstAlpha === -1) return part;
      return cleaned.slice(0, firstAlpha) + cleaned[firstAlpha].toUpperCase() + cleaned.slice(firstAlpha + 1);
    });
    return normalizedParts.join("-");
  });

  return tokens.join(" ");
}

function deriveReciterFields(clip) {
  const canonicalBySlug = {
    maher: "Maher al-Mu'aiqly",
    "maher-al-muaiqly": "Maher al-Mu'aiqly",
    "maher-al-mu-aiqly": "Maher al-Mu'aiqly",
    "maher-al-mu-aiqlee": "Maher al-Mu'aiqly",
    "maher-al-mu-aiqli": "Maher al-Mu'aiqly"
  };

  const reciterSlugRaw = clip.reciterSlug ?? clip.reciter ?? "";
  const reciterNameRaw = clip.reciterName ?? "";

  const looksLikeSlug = typeof reciterSlugRaw === "string" && /^[a-z0-9-]+$/.test(reciterSlugRaw);
  const looksLikeName = typeof reciterSlugRaw === "string" && /[A-Z\s'’]/.test(reciterSlugRaw);

  let reciterSlug = "";
  let reciterName = "";

  if (reciterNameRaw) {
    reciterName = normalizeReciterName(reciterNameRaw);
    reciterSlug = clip.reciterSlug ? slugify(clip.reciterSlug) : slugify(reciterName);
  } else if (looksLikeSlug && reciterSlugRaw) {
    reciterSlug = slugify(reciterSlugRaw);
    reciterName = normalizeReciterName(reciterSlug.replace(/-/g, " "));
  } else if (looksLikeName && reciterSlugRaw) {
    reciterName = normalizeReciterName(reciterSlugRaw);
    reciterSlug = slugify(reciterName);
  } else {
    reciterSlug = slugify(reciterSlugRaw);
    reciterName = normalizeReciterName(reciterSlugRaw);
  }

  if (canonicalBySlug[reciterSlug]) reciterName = canonicalBySlug[reciterSlug];

  if (!reciterSlug) throw new Error("Missing reciter slug");
  if (!reciterName) throw new Error("Missing reciter name");
  return { reciterSlug, reciterName };
}

function assertClip(clip) {
  if (!clip || typeof clip !== "object") throw new Error("Clip must be an object");
  if (typeof clip.id !== "string" || !clip.id) throw new Error("Clip.id must be a non-empty string");
  if (!isPositiveInt(clip.surah) || clip.surah > 114) throw new Error(`Clip.surah invalid for id=${clip.id}`);
  if (!isPositiveInt(clip.ayahStart)) throw new Error(`Clip.ayahStart invalid for id=${clip.id}`);
  if (!isPositiveInt(clip.ayahEnd) || clip.ayahEnd < clip.ayahStart)
    throw new Error(`Clip.ayahEnd invalid for id=${clip.id}`);
  if (clip.reciter != null && (typeof clip.reciter !== "string" || !clip.reciter))
    throw new Error(`Clip.reciter invalid for id=${clip.id}`);
  if (clip.reciterSlug != null && (typeof clip.reciterSlug !== "string" || !clip.reciterSlug))
    throw new Error(`Clip.reciterSlug invalid for id=${clip.id}`);
  if (clip.reciterName != null && (typeof clip.reciterName !== "string" || !clip.reciterName))
    throw new Error(`Clip.reciterName invalid for id=${clip.id}`);
  // Ensure we can derive reciter fields from either legacy or new format.
  deriveReciterFields(clip);
  if (clip.riwayah != null && (typeof clip.riwayah !== "string" || !clip.riwayah))
    throw new Error(`Clip.riwayah invalid for id=${clip.id}`);
  if (
    clip.translation != null &&
    clip.translation !== "saheeh-international" &&
    clip.translation !== "khan-al-hilali"
  ) {
    throw new Error(`Clip.translation invalid for id=${clip.id}`);
  }
  if (!Array.isArray(clip.variants) || clip.variants.length === 0) throw new Error(`Clip.variants invalid for id=${clip.id}`);
  for (const v of clip.variants) {
    if (!v || typeof v !== "object") throw new Error(`Variant invalid for id=${clip.id}`);
    if (v.quality !== "low" && v.quality !== "high") throw new Error(`Variant.quality invalid for id=${clip.id}`);
    if (typeof v.r2Key !== "string" || !v.r2Key) throw new Error(`Variant.r2Key invalid for id=${clip.id}`);
    if (v.md5 != null && (typeof v.md5 !== "string" || !/^[a-f0-9]{32}$/i.test(v.md5)))
      throw new Error(`Variant.md5 invalid for id=${clip.id}`);
  }
}

async function readJsonl(jsonlPath) {
  const fh = await fs.open(jsonlPath, "r");
  try {
    const rl = readline.createInterface({ input: fh.createReadStream(), crlfDelay: Infinity });
    const clips = [];
    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const obj = JSON.parse(trimmed);
      assertClip(obj);
      clips.push(obj);
    }
    return clips;
  } finally {
    await fh.close();
  }
}

function buildIndex(clips) {
  const byId = Object.create(null);
  const bySurah = Object.create(null);
  const byReciterSlug = Object.create(null);
  const byRiwayah = Object.create(null);
  const byTranslation = Object.create(null);

  for (const clip of clips) {
    if (byId[clip.id]) throw new Error(`Duplicate clip id: ${clip.id}`);
    const riwayah = clip.riwayah ?? "hafs-an-asim";
    const translation = clip.translation ?? "khan-al-hilali";
    const { reciterSlug, reciterName } = deriveReciterFields(clip);

    byId[clip.id] = { ...clip, reciterSlug, reciterName, riwayah, translation };
    (bySurah[String(clip.surah)] ??= []).push(clip.id);
    (byReciterSlug[reciterSlug] ??= []).push(clip.id);
    (byRiwayah[riwayah] ??= []).push(clip.id);
    (byTranslation[translation] ??= []).push(clip.id);
  }

  return {
    version: 3,
    generatedAt: new Date().toISOString(),
    clipCount: clips.length,
    clipsById: byId,
    indexes: { bySurah, byReciterSlug, byRiwayah, byTranslation }
  };
}

await fs.mkdir(DATA_DIR, { recursive: true });

let clips = [];
try {
  clips = await readJsonl(JSONL_PATH);
} catch (err) {
  if (err?.code === "ENOENT") {
    console.error(`Missing ${JSONL_PATH}. Create it first (even empty) and rerun.`);
    process.exit(1);
  }
  throw err;
}

clips.sort((a, b) => {
  if (a.surah !== b.surah) return a.surah - b.surah;
  if (a.ayahStart !== b.ayahStart) return a.ayahStart - b.ayahStart;
  if (a.ayahEnd !== b.ayahEnd) return a.ayahEnd - b.ayahEnd;
  return deriveReciterFields(a).reciterSlug.localeCompare(deriveReciterFields(b).reciterSlug);
});

const index = buildIndex(clips);
await fs.writeFile(INDEX_PATH, JSON.stringify(index, null, 2) + "\n", "utf8");
console.log(`Wrote ${path.relative(process.cwd(), INDEX_PATH)} (${index.clipCount} clips)`);
