import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { infrai } from "./infrai_storage.ts";

export function createBucketName(): string {
  return "course-media";
}

const BUCKET = createBucketName();

export function isExistingBucketError(error: unknown): boolean {
  return error instanceof Error && /already exists|bucket.*exists|conflict/i.test(error.message);
}

async function ensureBucket(): Promise<void> {
  try {
    await infrai.storage.bucket.create(BUCKET);
  } catch (error) {
    if (!isExistingBucketError(error)) throw error;
  }
}

export type ImageVariant = {
  name: "cover" | "thumbnail";
  width: number;
  height: number;
  key: string;
};

export function planCourseImages(courseId: string): ImageVariant[] {
  const safeCourseId = courseId.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  if (!safeCourseId) throw new Error("courseId must contain a letter or number");

  return [
    { name: "cover", width: 1280, height: 720, key: `courses/${safeCourseId}/cover.webp` },
    { name: "thumbnail", width: 480, height: 270, key: `courses/${safeCourseId}/thumbnail.webp` },
  ];
}

async function uploadVariant(key: string, bytes: Buffer): Promise<void> {
  const digest = createHash("sha256").update(bytes).digest("hex");
  const signed = await infrai.storage.object.presign(BUCKET, key, {
    op: "put",
    expires_seconds: 600,
    content_type: "image/webp",
    max_bytes: bytes.byteLength,
    idempotency_key: `${key}:${digest}`,
  });

  let response: Response;
  if (signed.method === "POST") {
    const form = new FormData();
    for (const [name, value] of Object.entries(signed.fields ?? {})) {
      form.append(name, value);
    }
    form.append("file", new Blob([new Uint8Array(bytes)], { type: "image/webp" }), "image.webp");
    response = await fetch(signed.url, { method: "POST", body: form });
  } else {
    response = await fetch(signed.url, {
      method: "PUT",
      headers: signed.headers ?? { "Content-Type": "image/webp" },
      body: new Uint8Array(bytes),
    });
  }
  if (!response.ok) {
    const detail = (await response.text()).trim();
    throw new Error(`Upload failed with HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
  }
}

async function deleteVariant(key: string): Promise<void> {
  await infrai.storage.object.delete(BUCKET, key);
}

export async function publishCourseImages(inputPath: string, courseId: string): Promise<string[]> {
  await ensureBucket();
  const variants = planCourseImages(courseId);

  const uploadedKeys: string[] = [];
  try {
    for (const variant of variants) {
      const bytes = await sharp(inputPath)
        .rotate()
        .resize(variant.width, variant.height, { fit: "cover", position: "centre" })
        .webp({ quality: 82 })
        .toBuffer();
      await uploadVariant(variant.key, bytes);
      uploadedKeys.push(variant.key);
    }
  } catch (error) {
    await Promise.allSettled(uploadedKeys.map((key) => deleteVariant(key)));
    throw error;
  }

  return variants.map((variant) => variant.key);
}

async function main(): Promise<void> {
  const [inputPath, courseId] = process.argv.slice(2);
  if (!inputPath || !courseId) {
    throw new Error("Usage: npm run upload -- <image-path> <course-id>");
  }
  const keys = await publishCourseImages(inputPath, courseId);
  console.log(JSON.stringify({ bucket: BUCKET, keys }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
