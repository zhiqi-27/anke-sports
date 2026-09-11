import { test } from "node:test";
import assert from "node:assert/strict";
import { handle } from "./index.mjs";
const env = {
  AZURE_API_ORIGIN: "https://example.azurewebsites.net",
  ASSETS: { fetch: () => new Response("asset") },
};
test("assets and unconfigured API fail separately", async () => {
  assert.equal(
    await (
      await handle(new Request("https://sports.anke-ai.com/calendar"), env)
    ).text(),
    "asset",
  );
  assert.equal(
    (await handle(new Request("https://sports.anke-ai.com/api/v1/me"), {}))
      .status,
    503,
  );
});
test("write preserves auth, origin, query and body; forbids cache and automatic redirect", async () => {
  const r = await handle(
    new Request("https://sports.anke-ai.com/api/v1/me/follows?x=1", {
      method: "PUT",
      headers: {
        Authorization: "Bearer fixture",
        Origin: "https://sports.anke-ai.com",
        "X-Forwarded-For": "forged",
      },
      body: "{}",
    }),
    env,
    async (req, opts) => {
      assert.equal(
        req.url,
        "https://example.azurewebsites.net/api/v1/me/follows?x=1",
      );
      assert.equal(req.headers.get("authorization"), "Bearer fixture");
      assert.equal(req.headers.get("origin"), "https://sports.anke-ai.com");
      assert.equal(req.headers.get("x-forwarded-for"), null);
      assert.equal(await req.text(), "{}");
      assert.equal(req.redirect, "manual");
      assert.equal(opts.cache, "no-store");
      return new Response("conflict", {
        status: 409,
        headers: { "Cache-Control": "public, max-age=3600" },
      });
    },
  );
  assert.equal(r.status, 409);
  assert.equal(r.headers.get("Cache-Control"), "no-store");
});
test("upstream failure does not disclose request or errors", async () => {
  const r = await handle(
    new Request("https://sports.anke-ai.com/api/v1/me"),
    env,
    () => {
      throw new Error("secret");
    },
  );
  assert.equal(r.status, 502);
  assert.ok(!(await r.text()).includes("secret"));
});
