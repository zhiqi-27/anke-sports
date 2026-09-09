import { readFile, writeFile, mkdir, rm, cp, readdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { build } from "esbuild";
import sharp from "sharp";

const root = dirname(fileURLToPath(import.meta.url));
const production = process.argv.includes("--production");
const check = process.argv.includes("--check");
const target = production ? "production" : check ? "check" : "local";
function origin(value, fallback) {
  const url = new URL(value || fallback);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      ))
  )
    throw new Error("Use an HTTPS origin, or explicit local loopback origin");
  if (
    production &&
    (url.protocol !== "https:" ||
      ["localhost", "127.0.0.1"].includes(url.hostname))
  )
    throw new Error("Production requires configured public HTTPS origins");
  return url.origin;
}
const api = origin(
  process.env.ANKE_EXTENSION_API_URL,
  check ? "http://localhost:18791" : "http://localhost:8787",
);
const web = origin(
  process.env.ANKE_EXTENSION_WEB_URL,
  check ? "http://localhost:18790" : "http://localhost:3000",
);
const config = { api, web, local: !production };
const out = resolve(root, "dist-" + target);
await rm(out, { recursive: true, force: true });
await mkdir(resolve(out, "icons"), { recursive: true });
await build({
  entryPoints: {
    popup: resolve(root, "src/popup.ts"),
    worker: resolve(root, "src/worker.ts"),
  },
  outdir: out,
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "chrome116",
  minify: false,
  define: { ANKE_BUILD_CONFIG: JSON.stringify(config) },
  sourcemap: false,
  legalComments: "none",
});
for (const name of ["popup.html", "popup.css"])
  await cp(resolve(root, "assets", name), resolve(out, name));
const svg = await readFile(resolve(root, "assets/icon.svg"));
for (const size of [16, 32, 48, 128])
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(resolve(out, `icons/icon-${size}.png`));
const key = production
  ? process.env.ANKE_EXTENSION_PUBLIC_KEY
  : (
      await readFile(resolve(root, "development-public-key.txt"), "utf8")
    ).trim();
const version = "0.1.0";
const iconPaths = Object.fromEntries(
  [16, 32, 48, 128].map((size) => [size, `icons/icon-${size}.png`]),
);
const manifest = {
  manifest_version: 3,
  minimum_chrome_version: "116",
  version,
  name: production ? "Anke Sports" : "Anke Sports · 本地",
  description:
    "查看近期体育赛程，将当前 YouTube 视频的原链接附到你确认的比赛。",
  permissions: ["activeTab", "storage", "identity"],
  host_permissions: [
    new URL(api).protocol + "//" + new URL(api).hostname + "/*",
  ],
  background: { service_worker: "worker.js", type: "module" },
  action: {
    default_title: "Anke Sports",
    default_popup: "popup.html",
    default_icon: iconPaths,
  },
  icons: iconPaths,
  content_security_policy: {
    extension_pages: `script-src 'self'; object-src 'none'; connect-src ${api}; base-uri 'none'`,
  },
  ...(key ? { key } : {}),
};
await writeFile(
  resolve(out, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
// Only the generated public client files go into the ZIP, never the repository.
await mkdir(resolve(root, "packages"), { recursive: true });
const zip = resolve(root, "packages", `anke-sports-${version}-${target}.zip`);
await rm(zip, { force: true });
execFileSync("zip", ["-q", "-r", zip, ...(await readdir(out))], { cwd: out });
const extensionId = key
  ? [
      ...createHash("sha256")
        .update(Buffer.from(key, "base64"))
        .digest("hex")
        .slice(0, 32),
    ]
      .map((n) => String.fromCharCode(97 + parseInt(n, 16)))
      .join("")
  : "assigned by Chrome Web Store";
console.log(
  JSON.stringify(
    {
      target,
      directory: out,
      zip,
      extensionId,
      api,
      web,
      sha256: createHash("sha256")
        .update(await readFile(zip))
        .digest("hex"),
    },
    null,
    2,
  ),
);
