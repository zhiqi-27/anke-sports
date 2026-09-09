// Isolated visual fixture: no extension installation, accounts, API calls or tab reads.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const files = new Map([
  ["/popup.js", ["dist-local/popup.js", "text/javascript"]],
  ["/popup.css", ["dist-local/popup.css", "text/css"]],
  ["/fixture.js", ["preview/fixture.js", "text/javascript"]],
  ["/preview.css", ["preview/preview.css", "text/css"]],
  ...[16, 32, 48, 128].map((n) => [
    `/icons/icon-${n}.png`,
    [`dist-local/icons/icon-${n}.png`, "image/png"],
  ]),
]);
const page = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Anke Sports · 扩展界面预览</title><link rel="stylesheet" href="/preview.css"><body><main><h1>Chrome 扩展 · 界面预览</h1><p>380 × 560 · 所有账号、比赛和保存结果均为合成示例。此页不读取浏览器标签、不连接账号、不写入日历。</p><nav><a href="/?scene=calendar">近期赛程</a><a href="/?scene=guest">未连接</a><a href="/?scene=readonly">只读连接</a><a href="/?scene=empty">空赛程</a><a href="/?scene=offline">断网</a><a href="/?scene=draft">视频草稿</a></nav><iframe title="Anke Sports 扩展合成界面" src="/popup.html?scene=SCENE"></iframe><p>实际 Chrome 安装、identity 授权和 activeTab 权限仍待验收。</p></main></body></html>`;
createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1:18792");
  const headers = {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'none'; frame-src 'self'; base-uri 'none'",
  };
  try {
    if (req.method !== "GET") {
      res.writeHead(405).end();
      return;
    }
    if (url.pathname === "/") {
      const scene = [
        "calendar",
        "guest",
        "readonly",
        "empty",
        "offline",
        "draft",
      ].includes(url.searchParams.get("scene"))
        ? url.searchParams.get("scene")
        : "calendar";
      res
        .writeHead(200, {
          ...headers,
          "Content-Type": "text/html; charset=utf-8",
        })
        .end(page.replace("SCENE", scene));
      return;
    }
    if (url.pathname === "/popup.html") {
      let html = await readFile(resolve(root, "dist-local/popup.html"), "utf8");
      html = html.replace(
        '<script src="popup.js"',
        '<script src="fixture.js"></script><script src="popup.js"',
      );
      res
        .writeHead(200, {
          ...headers,
          "Content-Type": "text/html; charset=utf-8",
        })
        .end(html);
      return;
    }
    const file = files.get(url.pathname);
    if (!file) {
      res.writeHead(404).end();
      return;
    }
    res
      .writeHead(200, { ...headers, "Content-Type": file[1] })
      .end(await readFile(resolve(root, file[0])));
  } catch {
    res.writeHead(500).end("Build the local extension before previewing.");
  }
}).listen(18792, "127.0.0.1", () =>
  console.log("Synthetic UI only: http://127.0.0.1:18792"),
);
