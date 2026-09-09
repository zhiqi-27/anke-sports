import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync, spawnSync } from "node:child_process";
import sharp from "sharp";

// Build first so the inspected ZIP is the reviewable artifact, never stale output.
execFileSync(process.execPath, ["extension/build.mjs"], { stdio: "pipe" });
const path = "extension/dist-local/";
const manifest = JSON.parse(await readFile(path + "manifest.json", "utf8"));
test("MV3 package has minimum permissions, local endpoints and no remote code", async () => {
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ["activeTab", "storage", "identity"]);
  assert.deepEqual(manifest.host_permissions, ["http://localhost/*"]);
  assert.equal(manifest.content_scripts, undefined);
  assert.equal(manifest.background.type, "module");
  assert.equal(manifest.action.default_popup, "popup.html");
  assert.match(
    manifest.content_security_policy.extension_pages,
    /connect-src http:\/\/localhost:8787;/,
  );
  const worker = await readFile(path + "worker.js", "utf8");
  assert.equal(/\beval\s*\(/.test(worker), false);
  const html = await readFile(path + "popup.html", "utf8");
  assert.equal(/\son\w+\s*=/.test(html), false);
  assert.equal(/<script(?![^>]*src=)[^>]*>/.test(html), false);
});
test("all declared icons exist at their exact PNG dimensions", async () => {
  for (const [size, file] of Object.entries(manifest.icons)) {
    const info = await sharp(path + file).metadata();
    assert.equal(info.format, "png");
    assert.equal(info.width, +size);
    assert.equal(info.height, +size);
  }
});
test("ZIP contains only generated extension files, excluding visual fixtures and secrets", () => {
  const files = execFileSync(
    "unzip",
    ["-Z1", "extension/packages/anke-sports-0.1.0-local.zip"],
    { encoding: "utf8" },
  )
    .trim()
    .split("\n")
    .filter((n) => !n.endsWith("/"))
    .sort();
  assert.deepEqual(
    files,
    [
      "icons/icon-128.png",
      "icons/icon-16.png",
      "icons/icon-32.png",
      "icons/icon-48.png",
      "manifest.json",
      "popup.css",
      "popup.html",
      "popup.js",
      "worker.js",
    ].sort(),
  );
});
test("production build refuses default localhost and unsafe origins", () => {
  for (const origin of [
    "",
    "http://example.test",
    "https://user:password@example.test",
    "https://example.test/path",
  ]) {
    const result = spawnSync(
      process.execPath,
      ["extension/build.mjs", "--production"],
      {
        env: {
          ...process.env,
          ANKE_EXTENSION_API_URL: origin,
          ANKE_EXTENSION_WEB_URL: "https://example.test",
        },
        encoding: "utf8",
      },
    );
    assert.notEqual(result.status, 0);
  }
});
