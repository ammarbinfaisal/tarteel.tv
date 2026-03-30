import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type { ClipVariant } from "@/lib/types";

function trimSlashes(s: string) {
  return s.replace(/^\/+/, "").replace(/\/+$/, "");
}

export function variantToPublicUrl(variant: ClipVariant): string | null {
  if (variant.url) return variant.url;
  const base = process.env.R2_PUBLIC_BASE_URL;
  if (!base) return null;
  return `${trimSlashes(base)}/${trimSlashes(variant.r2Key)}`;
}

let s3Client: S3Client | null = null;

export function getS3Client() {
  if (s3Client) return s3Client;

  if (!process.env.R2_ENDPOINT || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
    throw new Error("R2 configuration is missing");
  }

  s3Client = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
    requestHandler: new NodeHttpHandler({ connectionTimeout: 30000, socketTimeout: 600000 }),
  });

  return s3Client;
}

export async function uploadFile(key: string, filePath: string, contentType: string, md5?: string) {
  const s3 = getS3Client();
  const bucket = process.env.R2_BUCKET;
  if (!bucket) throw new Error("R2_BUCKET is missing");

  const upload = new Upload({
    client: s3,
    params: {
      Bucket: bucket,
      Key: key.replace(/^\/+/, ""),
      Body: fsSync.createReadStream(filePath),
      ContentType: contentType,
      Metadata: md5 ? { md5 } : {},
      CacheControl: "public, max-age=31536000, immutable",
    },
  });
  await upload.done();
}

export async function deletePrefix(prefix: string): Promise<number> {
  const s3 = getS3Client();
  const bucket = process.env.R2_BUCKET;
  if (!bucket) throw new Error("R2_BUCKET is missing");

  let deleted = 0;
  let continuationToken: string | undefined;

  do {
    const list = await s3.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix.replace(/^\/+/, ""),
      ContinuationToken: continuationToken,
    }));

    const keys = (list.Contents ?? []).map((obj) => ({ Key: obj.Key! }));
    if (keys.length > 0) {
      await s3.send(new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: keys },
      }));
      deleted += keys.length;
    }

    continuationToken = list.IsTruncated ? list.NextContinuationToken : undefined;
  } while (continuationToken);

  return deleted;
}

export async function uploadDir(localDir: string, remotePrefix: string) {
  const entries = await fs.readdir(localDir, { recursive: true, withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    // @ts-ignore - parentPath is available in newer node
    const fullPath = path.join(entry.parentPath || entry.path, entry.name);
    const relPath = path.relative(localDir, fullPath);
    const key = `${remotePrefix.replace(/\/+$/, "")}/${relPath.replace(/\\/g, "/")}`;
    const ext = path.extname(entry.name).toLowerCase();
    const contentType =
      ext === ".m3u8" ? "application/x-mpegURL" : (ext === ".ts" ? "video/MP2T" : "video/mp4");
    await uploadFile(key, fullPath, contentType);
  }
}

