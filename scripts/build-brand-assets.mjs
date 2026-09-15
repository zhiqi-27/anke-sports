import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { fileURLToPath } from "node:url";
const root = new URL("../", import.meta.url);
const master = await readFile(new URL("public/brand/mark.svg", root), "utf8");
const icon = master.replace(
  "<path",
  '<rect x="125" y="105" width="1040" height="1040" fill="#101215"/><path',
);
await writeFile(new URL("public/brand/icon.svg", root), icon);
await writeFile(new URL("src/app/icon.svg", root), icon);
for (const size of [16, 32, 48, 64, 128, 180, 192, 256, 512, 1024]) {
  await sharp(Buffer.from(icon))
    .resize(size, size)
    .png()
    .toFile(fileURLToPath(new URL(`public/brand/icon-${size}.png`, root)));
}
await sharp(Buffer.from(master))
  .resize(1024, 1024)
  .png()
  .toFile(fileURLToPath(new URL("public/brand/mark-1024.png", root)));
await sharp(Buffer.from(icon))
  .resize(180, 180)
  .png()
  .toFile(fileURLToPath(new URL("src/app/apple-icon.png", root)));
// ICO directory containing PNG entries, supported by modern browsers and Windows.
const sizes = [16, 32, 48];
const pngs = await Promise.all(
  sizes.map((size) =>
    sharp(Buffer.from(icon)).resize(size, size).png().toBuffer(),
  ),
);
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
pngs.forEach((png, i) => {
  const p = 6 + i * 16;
  header[p] = header[p + 1] = sizes[i];
  header.writeUInt16LE(1, p + 4);
  header.writeUInt16LE(32, p + 6);
  header.writeUInt32LE(png.length, p + 8);
  header.writeUInt32LE(offset, p + 12);
  offset += png.length;
});
await writeFile(
  new URL("src/app/favicon.ico", root),
  Buffer.concat([header, ...pngs]),
);
console.log("Brand assets generated from public/brand/mark.svg");
