import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const buildDirectory = ".next-cloudflare";
const expected = [
  [
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
      "anke-sports-dev.firebaseapp.com",
  ],
  [
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "anke-sports-dev",
  ],
];

for (const [name, value] of expected) {
  if (!value) throw new Error(`${name} is required for a deployment build.`);
}

async function collectJavascript(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const chunks = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return collectJavascript(entryPath);
      if (!entry.name.endsWith(".js")) return "";
      return readFile(entryPath, "utf8");
    }),
  );
  return chunks.join("\n");
}

const javascript = await collectJavascript(buildDirectory);
const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
if (
  !(apiKey ? javascript.includes(apiKey) : /AIza[\w-]{30,}/.test(javascript))
) {
  throw new Error(
    "NEXT_PUBLIC_FIREBASE_API_KEY was not embedded in the deployment build.",
  );
}
for (const [name, value] of expected) {
  if (!javascript.includes(value)) {
    throw new Error(`${name} was not embedded in the deployment build.`);
  }
}

console.log("Firebase Web configuration is present in the deployment build.");
