import { rm } from "node:fs/promises";

await Promise.all(
  [".next", ".next-cloudflare"].map((path) =>
    rm(path, { recursive: true, force: true }),
  ),
);
