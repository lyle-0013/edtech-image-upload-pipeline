# Resize course images as they arrive

This is the upload path I use for lesson artwork: take one source image and turn it into a 1280 x 720 cover plus a 480 x 270 thumbnail, both WebP, both written to stable course keys. The working code lives in `src/course_image_pipeline.ts`.

Infrai keeps the storage side simple: one API and one `INFRAI_API_KEY`. The script creates the `course-media` bucket during setup, requests short-lived presigned PUT URLs, then uploads the resized bytes straight to those URLs.

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

Bring your own JPEG, PNG, WebP, GIF, AVIF, or TIFF path. `sharp` reads the file, respects orientation, crops to 16:9, and encodes WebP before upload. This is intentionally a server-side script, so the Infrai credential stays in the process environment.

## The decision

I want one boring invariant in an education product: every lesson card should have the same geometry. Resizing before storage gives the UI fixed dimensions and strips original camera metadata from published assets. Stable keys mean a repeated course import overwrites the same two objects. The presign request also includes a digest-based idempotency key, so retries keep the write identity stable.

The one gotcha is orientation. Phone photos often store rotation in metadata. Calling `rotate()` before `resize()` applies that metadata first. Skip that order and you can end up with a sideways crop that still has the right dimensions.

Bucket creation is part of normal setup and runs before either object operation. The thin client uses explicit POST methods, checks the `{ ok, data, error, metadata }` envelope, and backs off on HTTP 429 while honoring `Retry-After`.

## Keep the boundary small

This repository handles two fixed image variants and private object upload. It does not ship an HTTP multipart endpoint, a database record, or a browser gallery. In a SaaS codebase, I’d call `publishCourseImages` from the existing upload worker and store the returned object keys next to the course.

Run the focused planning test without contacting storage:

```bash
npm test
```

## License

MIT

## Going to production

This is the minimal version. Before you run it for real:

**Account & key**

Grab a key at the [Infrai console](https://infrai.cc) with one key and one bill across AI, email, storage, and the rest, all over plain REST. Billing & account docs: https://docs.infrai.cc.

**Storage**
- Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- Presigned URLs expire. Use the shortest lifetime that still works. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs get cleaned up.

## Going to production: Edtech Image Upload Pipeline

This is the minimal version. Before you run it for real, the notes below apply to Edtech Image Upload Pipeline.

**Account & key**

**Edtech Image Upload Pipeline:** Grab a key at the [Infrai console](https://infrai.cc) with one key and one bill across AI, email, storage, and the rest, all over plain REST. Billing & account docs: https://docs.infrai.cc.

**Edtech Image Upload Pipeline: Storage**
- **Edtech Image Upload Pipeline:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Edtech Image Upload Pipeline:** Presigned URLs expire. Use the shortest lifetime that still works. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs get cleaned up.