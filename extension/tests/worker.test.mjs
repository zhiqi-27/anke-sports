import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  harness,
  signedIn,
  auth,
  token,
  owner,
  event,
  draft,
  config,
  videoFromTab,
} from "./harness.mjs";

for (const url of [
  "https://youtube.com/watch?v=abcdefghijk&x=secret",
  "https://youtu.be/abcdefghijk?si=secret",
  "https://www.youtube.com/shorts/abcdefghijk",
  "https://m.youtube.com/live/abcdefghijk",
]) {
  test(`canonical video from ${new URL(url).hostname}${new URL(url).pathname}`, () => {
    const result = videoFromTab({ url, title: "合成标题 - YouTube" });
    assert.equal(result.url, "https://www.youtube.com/watch?v=abcdefghijk");
    assert.equal(result.title, "合成标题");
  });
}
test("non-video, lookalike, credential, custom-port and missing grants rejected", () => {
  for (const url of [
    undefined,
    "chrome://extensions",
    "https://youtube.com/",
    "https://youtube.com/@creator",
    "https://youtube.com.evil.test/watch?v=abcdefghijk",
    "https://u:p@youtube.com/watch?v=abcdefghijk",
    "https://youtube.com:444/watch?v=abcdefghijk",
    "http://youtube.com/watch?v=abcdefghijk",
  ])
    assert.throws(() => videoFromTab({ url }));
});
test("opening and fetching schedule never reads current tab or exposes credentials", async () => {
  const h = harness({ session: signedIn({ flow: { verifier: "secret" } }) });
  const state = await h.send({ type: "state" });
  assert.equal(state.ok, true);
  assert.equal(state.data.cache, null);
  assert.equal(JSON.stringify(state).includes(h.session.auth.access), false);
  assert.equal(JSON.stringify(state).includes("secret"), false);
  const schedule = await h.send({
    type: "schedule",
    dataset: "demo",
    followed: true,
  });
  assert.equal(schedule.data.cache.items.length, 1);
  assert.equal(h.reads, 0);
  await h.send({ type: "current_video" });
  assert.equal(h.reads, 1);
  assert.equal(h.session.draft.ownerId, owner.id);
});
test("state is restored across a worker restart, but rejected across backend or owner change", async () => {
  const h = harness({ session: signedIn({ draft: draft() }) });
  h.restart();
  assert.equal(
    (await h.send({ type: "state" })).data.draft.id,
    "fixture-draft",
  );
  h.session.profile = { ...owner, id: "someone-else" };
  assert.equal((await h.send({ type: "state" })).data.draft, null);
  h.session.instance = "https://different.test";
  assert.equal((await h.send({ type: "state" })).data.connected, false);
  assert.equal(h.session.draft, undefined);
});
test("untrusted senders and arbitrary destinations cannot invoke API or read tabs", async () => {
  const h = harness({ session: signedIn() });
  for (const sender of [
    { id: "other", url: "https://evil.test" },
    { id: "fixture-extension", url: "https://youtube.com" },
  ])
    assert.equal(
      (await h.send({ type: "current_video" }, sender)).code,
      "UNTRUSTED_SENDER",
    );
  assert.equal(
    (await h.send({ type: "fetch", url: "https://evil.test" })).ok,
    false,
  );
  assert.equal(
    (await h.send({ type: "open_web", page: "https://evil.test" })).ok,
    false,
  );
  assert.equal(h.reads, 0);
  assert.equal(h.calls.length, 0);
});
test("PKCE, own resource and minimal scopes bind the complete login exchange", async () => {
  let request;
  const h = harness({
    launch: async (url) => {
      request = new URL(url);
      const result = new URL(request.searchParams.get("redirect_uri"));
      result.searchParams.set("state", request.searchParams.get("state"));
      result.searchParams.set("iss", config.api + "/");
      result.searchParams.set("code", "fixture-code");
      return result.href;
    },
  });
  const result = await h.send({ type: "login" });
  assert.equal(result.ok, true);
  assert.equal(result.data.connected, true);
  const tokenCall = h.calls.find((c) => c.path === "/token");
  const form = tokenCall.init.body;
  assert.equal(
    createHash("sha256").update(form.get("code_verifier")).digest("base64url"),
    request.searchParams.get("code_challenge"),
  );
  assert.equal(form.get("resource"), config.api + "/api/v1");
  assert.equal(
    request.searchParams.get("scope"),
    "calendar:read calendar:write",
  );
  assert.equal(h.session.flow, undefined);
  assert.equal(h.session.connectingUntil, undefined);
  assert.equal(h.reads, 0);
  assert.deepEqual(Object.keys(h.local), ["registration"]);
});
for (const mismatch of [
  "state",
  "iss",
  "callback",
  "duplicate_state",
  "expired",
]) {
  test(`reject callback ${mismatch} before token exchange`, async () => {
    const h = harness({
      launch: async (url) => {
        const request = new URL(url),
          result = new URL(request.searchParams.get("redirect_uri"));
        result.searchParams.set("state", request.searchParams.get("state"));
        result.searchParams.set("iss", config.api + "/");
        result.searchParams.set("code", "fixture-code");
        if (mismatch === "callback") result.pathname = "/other";
        else if (mismatch === "duplicate_state")
          result.searchParams.append("state", "duplicate");
        else if (mismatch === "expired") h.session.flow.expiresAt = 0;
        else result.searchParams.set(mismatch, "wrong");
        return result.href;
      },
    });
    assert.equal((await h.send({ type: "login" })).code, "INVALID_CALLBACK");
    assert.equal(
      h.calls.some((c) => c.path === "/token"),
      false,
    );
    assert.equal(h.session.auth, undefined);
    assert.equal(h.session.flow, undefined);
  });
}
test("cancelled login clears pending flow; next click registers anew", async () => {
  const h = harness({
    launch: async () => {
      throw new Error("Closed");
    },
  });
  assert.equal((await h.send({ type: "login" })).code, "LOGIN_CANCELLED");
  assert.equal(h.session.flow, undefined);
  assert.equal(h.local.registration, undefined);
});
test("unexpected or insufficient grant is revoked, read-only grant is usable", async () => {
  for (const scope of [
    "calendar:write",
    "calendar:read feed:read",
    "calendar:read",
  ]) {
    const h = harness({
      fetcher: async (path) =>
        path === "/token"
          ? {
              access_token: token("as_at_"),
              refresh_token: token("as_rt_"),
              expires_in: 300,
              scope,
            }
          : undefined,
    });
    const result = await h.send({ type: "login" });
    assert.equal(result.ok, scope === "calendar:read");
    if (result.ok) assert.equal(result.data.canWrite, false);
    else {
      assert.equal(result.code, "INVALID_SCOPE");
      assert.equal(
        h.calls.some((c) => c.path === "/revoke"),
        true,
      );
    }
  }
});
test("concurrent requests rotate refresh once; restart retains the replacement", async () => {
  const session = signedIn();
  session.auth.expiresAt = 0;
  const h = harness({ session });
  const replies = await Promise.all([
    h.send({ type: "schedule", dataset: "demo", followed: true }),
    h.send({ type: "schedule", dataset: "real", followed: false }),
  ]);
  assert.equal(
    replies.every((r) => r.ok),
    true,
  );
  assert.equal(h.calls.filter((c) => c.path === "/token").length, 1);
  h.restart();
  await h.send({ type: "schedule", dataset: "real", followed: true });
  assert.equal(h.calls.filter((c) => c.path === "/token").length, 1);
  assert.equal(h.session.auth.refresh, token("as_rt_", "b"));
});
test("uncertain refresh clears identity and never replays consumed token", async () => {
  const session = signedIn({ draft: draft() });
  session.auth.expiresAt = 0;
  const h = harness({
    session,
    fetcher: async (path) => {
      if (path === "/token") throw new Error("response lost");
    },
  });
  assert.equal(
    (await h.send({ type: "schedule", dataset: "demo", followed: true })).code,
    "NETWORK",
  );
  h.restart();
  assert.equal(
    (await h.send({ type: "schedule", dataset: "demo", followed: true })).code,
    "AUTH_REQUIRED",
  );
  assert.equal(h.calls.filter((c) => c.path === "/token").length, 1);
  assert.equal(h.session.draft, undefined);
});
test("incomplete pagination retains last successful schedule", async () => {
  const cache = {
    ownerId: owner.id,
    items: [event],
    fetchedAt: 1,
    dataset: "demo",
    followed: true,
  };
  const h = harness({
    session: signedIn({ cache }),
    fetcher: async (path) =>
      path === "/api/v1/events"
        ? { items: [event], next_cursor: "more" }
        : undefined,
  });
  assert.equal(
    (await h.send({ type: "schedule", dataset: "demo", followed: true })).code,
    "TOO_MANY_EVENTS",
  );
  assert.deepEqual(h.session.cache, cache);
});
test("invalid calendar date is rejected without network access", async () => {
  const h = harness({ session: signedIn() });
  assert.equal(
    (
      await h.send({
        type: "find_events",
        q: "",
        date: "2026-02-31",
        dataset: "demo",
      })
    ).code,
    "INVALID_DATE",
  );
  assert.equal(h.calls.length, 0);
});
const submit = {
  type: "submit",
  draftId: "fixture-draft",
  eventId: event.id,
  title: "合成标题",
  kind: "preview",
};
test("save persists idempotency key before request; lost response + worker restart reuses it", async () => {
  let lose = true;
  const keys = [];
  const h = harness({
    session: signedIn({ draft: draft() }),
    fetcher: async (path, init) => {
      if (path.endsWith("/links")) {
        keys.push(init.headers["Idempotency-Key"]);
        assert.equal(h.session.draft.key, keys.at(-1));
        if (lose) {
          lose = false;
          throw new Error("lost response");
        }
      }
    },
  });
  assert.equal((await h.send(submit)).code, "NETWORK");
  assert.equal(h.session.draft.outcome, undefined);
  h.restart();
  assert.equal((await h.send(submit)).data.outcome, "saved");
  assert.equal(keys[0], keys[1]);
  await h.send({ ...submit, title: "改过的标题" });
  assert.notEqual(keys[1], keys[2]);
});
test("blocked video is reported hidden; no false subscription publication", async () => {
  const h = harness({
    session: signedIn({ draft: draft() }),
    fetcher: async (path) =>
      path.endsWith("/links") ? { id: "link-1", event } : undefined,
  });
  assert.equal((await h.send(submit)).data.outcome, "hidden");
});
test("read-only connection cannot save and stale-owner draft cannot be sent", async () => {
  const session = signedIn({ draft: draft() });
  session.auth.scopes = ["calendar:read"];
  const h = harness({ session });
  assert.equal((await h.send(submit)).code, "WRITE_SCOPE");
  assert.equal(
    h.calls.some((c) => c.path.endsWith("/links")),
    false,
  );
  session.auth.scopes.push("calendar:write");
  session.draft.ownerId = "other";
  assert.equal((await h.send(submit)).code, "DRAFT_EXPIRED");
  assert.equal(h.session.draft.outcome, undefined);
});
test("logout waits for in-flight mutation then revokes and clears all owner data", async () => {
  let entered, release;
  const gate = new Promise((r) => {
    release = r;
  });
  const arrived = new Promise((r) => {
    entered = r;
  });
  const h = harness({
    session: signedIn({ draft: draft() }),
    fetcher: async (path) => {
      if (path.endsWith("/links")) {
        entered();
        await gate;
      }
    },
  });
  const saving = h.send(submit);
  await arrived;
  const logout = h.send({ type: "logout" });
  release();
  assert.equal((await saving).ok, true);
  assert.equal((await logout).data.connected, false);
  for (const key of ["auth", "profile", "cache", "draft"])
    assert.equal(h.session[key], undefined);
  assert.equal(h.calls.at(-1).path, "/revoke");
});
test("failed revocation still clears local credentials and reports uncertainty", async () => {
  const h = harness({
    session: signedIn({ draft: draft() }),
    fetcher: async (path) => {
      if (path === "/revoke") throw new Error("offline");
    },
  });
  const result = await h.send({ type: "logout" });
  assert.equal(result.ok, true);
  assert.equal(result.data.connected, false);
  assert.match(result.data.notice, /未确认/);
});
test("revoked bearer clears cached owner data on API 401", async () => {
  const h = harness({
    session: signedIn({ draft: draft() }),
    fetcher: async (path) =>
      path === "/api/v1/me/calendar"
        ? Response.json({}, { status: 401 })
        : undefined,
  });
  assert.equal((await h.send({ type: "current_video" })).code, "AUTH_REQUIRED");
  assert.equal(h.session.draft, undefined);
  assert.equal(h.reads, 0);
});
