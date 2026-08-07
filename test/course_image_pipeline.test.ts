import assert from "node:assert/strict";
import test from "node:test";
import { createBucketName, isExistingBucketError, planCourseImages } from "../src/course_image_pipeline.ts";

test("uses the documented course media bucket", () => {
  assert.equal(createBucketName(), "course-media");
});

test("recognizes only a reusable bucket conflict", () => {
  assert.equal(isExistingBucketError(new Error("bucket already exists")), true);
  assert.equal(isExistingBucketError(new Error("request timed out")), false);
});

test("plans stable lesson-card keys and a 16:9 crop", () => {
  const variants = planCourseImages("Biology 101 / Cells");

  assert.deepEqual(variants, [
    {
      name: "cover",
      width: 1280,
      height: 720,
      key: "courses/biology-101-cells/cover.webp",
    },
    {
      name: "thumbnail",
      width: 480,
      height: 270,
      key: "courses/biology-101-cells/thumbnail.webp",
    },
  ]);
});
