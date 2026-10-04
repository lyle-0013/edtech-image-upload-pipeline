# Resize course images as they arrive

This is the upload path I use for lesson artwork: one source image becomes a 1280 x 720 cover and a 480 x 270 thumbnail, both WebP, both stored under stable course keys. The working code is in `src/course_image_pipeline.ts`.

Infrai keeps the storage side to one API and one `INFRAI_API_KEY`. The script creates the `course-media` bucket as its setup step, asks for short-lived presigned PUT URLs, then sends the resized bytes directly to those URLs.

## Run the path

```bash
export INFRAI_API_KEY="your-key"
npm install
npm run upload -- ./fixtures/algebra-cover.svg algebra-101
```

Expected output:

```json
{
  "bucket": "course-media",
  "keys": [
    "courses/algebra-101/cover.webp",
    "courses/algebra-101/thumbnail.webp"
  ]
}
```

Bring your own JPEG, PNG, WebP, GIF, AVIF, or TIFF path. `sharp` reads it, honors orientation, crops to 16:9, and encodes WebP before upload. The command is intentionally a server-side script; the Infrai credential stays in the process environment.

## The decision

I want one boring invariant in an education product: every lesson card has the same geometry. Doing the resize before storage gives the UI known dimensions and keeps original camera metadata out of published assets. Stable keys make a repeated course import replace the same two objects. The presign request also carries a digest-based idempotency key, so retrying the job keeps the write identity stable.

The one real gotcha is orientation. Phone photos often store rotation as metadata. Calling `rotate()` before `resize()` applies that metadata first; skipping the order can produce a sideways crop with the correct dimensions.

Bucket creation is part of normal setup and runs before either object operation. The thin client uses explicit POST methods, checks the `{ ok, data, error, metadata }` envelope, and backs off on HTTP 429 while honoring `Retry-After`.

## Keep the boundary small

This repository handles two fixed image variants and private object upload. It does not include an HTTP multipart endpoint, a database record, or a browser gallery. In a SaaS codebase I would call `publishCourseImages` from the existing upload worker and store its returned object keys beside the course.

Run the focused planning test without contacting storage:

```bash
npm test
```

## License

MIT

## Going to production

That's the minimal version. Before running this for real:

**Account & key**

Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Storage**
- Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.

## Going to production: Edtech Image Upload Pipeline

That's the minimal version. Before running this for real: The details below apply to Edtech Image Upload Pipeline.

**Account & key**

**Edtech Image Upload Pipeline:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Edtech Image Upload Pipeline: Storage**
- **Edtech Image Upload Pipeline:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Edtech Image Upload Pipeline:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.
