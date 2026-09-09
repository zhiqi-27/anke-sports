import { build } from "esbuild";
import { runInNewContext } from "node:vm";
import { webcrypto } from "node:crypto";

export const config = {
  api: "http://localhost:8787",
  web: "http://localhost:3000",
  local: true,
};
const bundles = {};
for (const name of ["worker", "shared"]) {
  const result = await build({
    entryPoints: [`extension/src/${name}.ts`],
    bundle: true,
    write: false,
    format: "iife",
    globalName: "subject",
    platform: "browser",
    define: { ANKE_BUILD_CONFIG: JSON.stringify(config) },
  });
  bundles[name] = result.outputFiles[0].text;
}
export const token = (prefix, char = "a") => prefix + char.repeat(48);
export const auth = () => ({
  access: token("as_at_"),
  refresh: token("as_rt_"),
  expiresAt: Date.now() + 3600000,
  scopes: ["calendar:read", "calendar:write"],
  clientId: "test-client",
  resource: config.api + "/api/v1",
});
export const owner = {
  id: "fixture-owner",
  display_name: "合成验收账号",
  timezone: "Asia/Shanghai",
};
export const event = {
  id: "fixture-event",
  title: "合成红队 vs 合成蓝队",
  starts_at: new Date(Date.now() + 3600000).toISOString(),
  sport: "basketball",
  status: "scheduled",
  demo: true,
  included: true,
  links: [],
};
export const draft = () => ({
  id: "fixture-draft",
  ownerId: owner.id,
  createdAt: Date.now(),
  url: "https://www.youtube.com/watch?v=abcdefghijk",
  title: "合成标题",
});
const clone = (value) => structuredClone(value);
function storageArea(data) {
  return {
    async get(keys) {
      return clone(
        keys === null
          ? data
          : Object.fromEntries(
              (Array.isArray(keys) ? keys : [keys])
                .filter((k) => k in data)
                .map((k) => [k, data[k]]),
            ),
      );
    },
    async set(values) {
      Object.assign(data, clone(values));
    },
    async remove(keys) {
      for (const key of Array.isArray(keys) ? keys : [keys]) delete data[key];
    },
    async clear() {
      for (const key of Object.keys(data)) delete data[key];
    },
  };
}
export function harness({
  session = { instance: config.api },
  local = {},
  fetcher,
  launch,
} = {}) {
  const calls = [],
    opened = [],
    pending = new Map();
  let reads = 0,
    listener;
  const locks = {
    async request(name, options, callback) {
      if (typeof options === "function") {
        callback = options;
        options = {};
      }
      if (options.ifAvailable && pending.has(name)) return callback(null);
      const before = pending.get(name);
      let release;
      const held = new Promise((r) => {
        release = r;
      });
      pending.set(name, held);
      if (before) await before;
      try {
        return await callback({ name });
      } finally {
        release();
        if (pending.get(name) === held) pending.delete(name);
      }
    },
  };
  const runtime = {
    id: "fixture-extension",
    getURL: (path) => `chrome-extension://fixture-extension/${path}`,
    onMessage: {
      addListener(fn) {
        listener = fn;
      },
    },
  };
  const chrome = {
    runtime,
    storage: { session: storageArea(session), local: storageArea(local) },
    tabs: {
      async query() {
        reads++;
        return [
          {
            url: "https://www.youtube.com/watch?v=abcdefghijk&tracking=private",
            title: "合成标题 - YouTube",
          },
        ];
      },
      async create(value) {
        opened.push(value);
      },
    },
    identity: {
      getRedirectURL: (path) =>
        `https://fixture-extension.chromiumapp.org/${path}`,
      async launchWebAuthFlow({ url }) {
        if (launch) return launch(url);
        const input = new URL(url),
          result = new URL(input.searchParams.get("redirect_uri"));
        for (const [k, v] of Object.entries({
          state: input.searchParams.get("state"),
          iss: config.api + "/",
          code: "fixture-code",
        }))
          result.searchParams.set(k, v);
        return result.href;
      },
    },
  };
  const fetch = async (url, init) => {
    const path = new URL(url).pathname;
    calls.push({ url, path, init });
    const override = fetcher ? await fetcher(path, init, url) : undefined;
    if (override instanceof Response) return override;
    let body = override;
    if (body === undefined) {
      if (path === "/.well-known/oauth-authorization-server")
        body = {
          issuer: config.api + "/",
          authorization_endpoint: config.api + "/authorize",
          token_endpoint: config.api + "/token",
        };
      else if (path === "/register") body = { client_id: "test-client" };
      else if (path === "/token")
        body = {
          access_token: token("as_at_", "b"),
          refresh_token: token("as_rt_", "b"),
          expires_in: 3600,
          scope: "calendar:read calendar:write",
        };
      else if (path === "/revoke") body = {};
      else if (path === "/api/v1/me/calendar")
        body = {
          ...owner,
          config: { preferences: { timezone: owner.timezone } },
        };
      else if (path === "/api/v1/events")
        body = { items: [event], next_cursor: null };
      else if (path === "/api/v1/events/fixture-event") body = event;
      else if (path === "/api/v1/events/fixture-event/links")
        body = { id: "link-1", event: { ...event, links: [{ id: "link-1" }] } };
      else throw new Error("Unexpected fixture route");
    }
    return Response.json(body);
  };
  const context = {
    chrome,
    navigator: { locks },
    crypto: webcrypto,
    TextEncoder,
    URL,
    URLSearchParams,
    Uint8Array,
    Date,
    Intl,
    AbortSignal,
    fetch,
    btoa,
    console: { log() {} },
    structuredClone,
  };
  function restart() {
    runInNewContext(bundles.worker, { ...context });
  }
  restart();
  return {
    session,
    local,
    calls,
    opened,
    get reads() {
      return reads;
    },
    restart,
    send(
      message,
      sender = { id: runtime.id, url: runtime.getURL("popup.html") },
    ) {
      return new Promise((resolve) =>
        listener(message, sender, (value) => resolve(clone(value))),
      );
    },
  };
}
const sharedContext = { URL };
runInNewContext(bundles.shared, sharedContext);
export const videoFromTab = sharedContext.subject.videoFromTab;
export const signedIn = (extra = {}) => ({
  instance: config.api,
  auth: auth(),
  profile: owner,
  ...extra,
});
