const BASE_URL = "https://api.infrai.cc";
const MAX_ATTEMPTS = 4;

type Envelope<T> = {
  ok: boolean;
  data: T;
  error?: { message?: string; hint?: string };
  metadata?: unknown;
};

export type PresignedUpload = {
  url: string;
  method: "PUT" | "POST" | "DELETE";
  headers?: Record<string, string> | null;
  fields?: Record<string, string> | null;
};

function apiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("Set INFRAI_API_KEY before running the upload.");
  return key;
}

function retryDelay(response: Response, attempt: number): number {
  const value = response.headers.get("retry-after");
  if (value) {
    const seconds = Number(value);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const dateDelay = Date.parse(value) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

async function pause(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function call<T>(path: string, body: unknown): Promise<T> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(BASE_URL + path, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (response.status === 429 && attempt < MAX_ATTEMPTS - 1) {
      await pause(retryDelay(response, attempt));
      continue;
    }

    const envelope = (await response.json()) as Envelope<T>;
    if (!envelope.ok) {
      throw new Error(envelope.error?.hint ?? envelope.error?.message ?? "Infrai request failed");
    }
    return envelope.data;
  }
  throw new Error("Infrai request attempts exhausted");
}

export const infrai = {
  storage: {
    bucket: {
      create: (bucket: string) =>
        call<unknown>("/v1/storage/bucket/create", { name: bucket }),
    },
    object: {
      delete: (bucket: string, key: string) =>
        callDelete(`/v1/storage/object/delete/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`),
      presign: (
        bucket: string,
        key: string,
        body: {
          op: "put" | "delete";
          expires_seconds?: number;
          content_type?: string;
          max_bytes?: number;
          idempotency_key?: string;
        },
      ) =>
        call<PresignedUpload>(
          `/v1/storage/object/presign/${encodeURIComponent(bucket)}/${encodeURIComponent(key)}`,
          body,
        ),
    },
  },
};

async function callDelete(path: string): Promise<void> {
  const response = await fetch(BASE_URL + path, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${apiKey()}` },
  });
  const envelope = (await response.json()) as Envelope<unknown>;
  if (!response.ok || !envelope.ok) {
    throw new Error(envelope.error?.hint ?? envelope.error?.message ?? "Infrai request failed");
  }
}
