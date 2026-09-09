import { config, issuer, resource, ClientError, videoFromTab } from "./shared";
import type {
  AddedLink,
  Cache,
  CalendarUser,
  Dataset,
  Draft,
  EventPage,
  Kind,
  Message,
  Profile,
  SportEvent,
  ViewState,
} from "./shared";

type Auth = {
  access: string;
  refresh: string;
  expiresAt: number;
  scopes: string[];
  clientId: string;
  resource: string;
};
type Registration = { id: string; callback: string; issuer: string };
type Flow = {
  verifier: string;
  state: string;
  issuer: string;
  callback: string;
  expiresAt: number;
};
type State = {
  instance?: string;
  auth?: Auth;
  profile?: Profile;
  cache?: Cache;
  draft?: Draft;
  connectingUntil?: number;
  notice?: string;
};
const DEFAULTS = {
  dataset: config.local ? ("demo" as Dataset) : ("real" as Dataset),
  followed: true,
};

async function store(): Promise<State> {
  const state: State = await chrome.storage.session.get(null);
  if (state.instance !== config.api) {
    await chrome.storage.session.clear();
    await chrome.storage.session.set({ instance: config.api });
    return { instance: config.api };
  }
  return state;
}

async function forgetAuth(notice: string) {
  await chrome.storage.session.remove(["auth", "profile", "cache", "draft"]);
  await chrome.storage.session.set({ notice });
}

async function preferences() {
  const { preferences } = (await chrome.storage.local.get("preferences")) as {
    preferences?: { dataset?: unknown; followed?: unknown };
  };
  return {
    dataset:
      config.local && preferences?.dataset === "demo"
        ? ("demo" as Dataset)
        : preferences?.dataset === "real"
          ? ("real" as Dataset)
          : DEFAULTS.dataset,
    followed:
      typeof preferences?.followed === "boolean" ? preferences.followed : true,
  };
}

async function stateView(): Promise<ViewState> {
  const s = await store();
  const draft =
    s.auth &&
    s.draft &&
    s.draft.ownerId === s.profile?.id &&
    Date.now() - s.draft.createdAt < 86400000
      ? s.draft
      : null;
  return {
    connected: !!s.auth,
    canWrite: s.auth?.scopes.includes("calendar:write") || false,
    connecting: (s.connectingUntil || 0) > Date.now(),
    local: config.local,
    profile: s.profile || null,
    cache:
      s.auth && s.cache && s.cache.ownerId === s.profile?.id ? s.cache : null,
    draft,
    preferences: await preferences(),
    notice: s.notice || "",
  };
}

async function fetchJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(config.api + path, {
      ...init,
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new ClientError(
      "NETWORK",
      "暂时无法连接日历服务，请检查服务和网络后重试",
    );
  }
  const text = await response.text();
  if (text.length > 2000000)
    throw new ClientError("RESPONSE_TOO_LARGE", "查询结果过大，请缩小范围");
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new ClientError("INVALID_RESPONSE", "日历服务返回了无效内容");
  }
  if (!response.ok) {
    if (response.status === 401)
      throw new ClientError("AUTH_REQUIRED", "连接已失效，请重新连接账号");
    throw new ClientError(
      body.error?.code || "REQUEST_FAILED",
      typeof body.error?.message === "string"
        ? body.error.message
        : "请求未完成，请重试或重新连接账号",
    );
  }
  return body as T;
}

async function tokens(
  form: Record<string, string>,
  clientId: string,
): Promise<Auth> {
  const value = await fetchJson<{
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string;
  }>("/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...form, client_id: clientId, resource }),
  });
  if (
    !/^as_at_[A-Za-z0-9_-]{32,}$/.test(value.access_token) ||
    !/^as_rt_[A-Za-z0-9_-]{32,}$/.test(value.refresh_token) ||
    !(value.expires_in > 0 && value.expires_in <= 3600) ||
    typeof value.scope !== "string"
  )
    throw new ClientError("INVALID_RESPONSE", "授权响应无效，请重新连接");
  const scopes = value.scope.split(" ");
  const auth = {
    access: value.access_token,
    refresh: value.refresh_token,
    expiresAt: Date.now() + value.expires_in * 1000,
    scopes,
    clientId,
    resource,
  };
  if (
    !scopes.includes("calendar:read") ||
    scopes.some((s) => !["calendar:read", "calendar:write"].includes(s))
  ) {
    try {
      await revoke(auth);
    } catch {
      throw new ClientError(
        "INVALID_SCOPE",
        "授权范围不匹配，请到网页设置撤销此连接后重新连接",
      );
    }
    throw new ClientError(
      "INVALID_SCOPE",
      "查看赛程需要允许读取日历，请重新连接",
    );
  }
  return auth;
}

async function access(): Promise<Auth> {
  return navigator.locks.request("anke-connection", async () => {
    const s = await store();
    if (!s.auth || s.auth.resource !== resource)
      throw new ClientError("AUTH_REQUIRED", "请先连接 Anke Sports 账号");
    if (s.auth.expiresAt > Date.now() + 60000) return s.auth;
    try {
      const auth = await tokens(
        { grant_type: "refresh_token", refresh_token: s.auth.refresh },
        s.auth.clientId,
      );
      await chrome.storage.session.set({ auth });
      return auth;
    } catch (e) {
      // A lost refresh response may have consumed the one-use token. Never replay it.
      await forgetAuth(
        "连接刷新未确认，请重新连接；原应用连接可在网页设置中撤销",
      );
      throw e;
    }
  });
}

async function api<T>(
  path: string,
  init: RequestInit = {},
  write = false,
): Promise<T> {
  const auth = await access();
  if (write && !auth.scopes.includes("calendar:write"))
    throw new ClientError(
      "WRITE_SCOPE",
      "此连接仅能查看赛程，请重新连接并允许管理链接",
    );
  try {
    return await fetchJson<T>("/api/v1" + path, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${auth.access}` },
    });
  } catch (e) {
    if (e instanceof ClientError && e.code === "AUTH_REQUIRED")
      await forgetAuth(e.message);
    throw e;
  }
}

async function profile(): Promise<Profile> {
  const user = await api<CalendarUser>("/me/calendar");
  const value = {
    id: user.id,
    display_name: user.display_name,
    timezone: user.config.preferences.timezone,
  };
  const s = await store();
  if (s.profile && s.profile.id !== value.id)
    await chrome.storage.session.remove(["cache", "draft"]);
  await chrome.storage.session.set({ profile: value });
  return value;
}

async function revoke(auth: Auth) {
  await fetchJson("/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: auth.clientId,
      token: auth.refresh,
      token_type_hint: "refresh_token",
    }),
  });
}

function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function login() {
  await store();
  await navigator.locks.request(
    "anke-connection",
    { ifAvailable: true },
    async (lock) => {
      if (!lock)
        throw new ClientError(
          "CONNECTING",
          "另一个连接操作尚未结束，请稍后重试",
        );
      await chrome.storage.session.set({
        connectingUntil: Date.now() + 600000,
        notice: "",
      });
      try {
        const old = (await store()).auth;
        const metadata = await fetchJson<Record<string, unknown>>(
          "/.well-known/oauth-authorization-server",
        );
        if (
          metadata.issuer !== issuer ||
          metadata.authorization_endpoint !== config.api + "/authorize" ||
          metadata.token_endpoint !== config.api + "/token"
        )
          throw new ClientError(
            "ISSUER_MISMATCH",
            "授权服务身份与扩展配置不一致",
          );
        const callback = chrome.identity.getRedirectURL("callback");
        let { registration } = (await chrome.storage.local.get(
          "registration",
        )) as { registration?: Registration };
        if (
          !registration ||
          registration.callback !== callback ||
          registration.issuer !== issuer
        ) {
          const client = await fetchJson<{ client_id: string }>("/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              client_name: config.local
                ? "Anke Sports Chrome · 本地"
                : "Anke Sports Chrome",
              redirect_uris: [callback],
              grant_types: ["authorization_code", "refresh_token"],
              response_types: ["code"],
              token_endpoint_auth_method: "none",
              scope: "calendar:read calendar:write",
            }),
          });
          if (
            typeof client.client_id !== "string" ||
            client.client_id.length > 200
          )
            throw new ClientError("INVALID_CLIENT", "无法创建应用连接");
          registration = { id: client.client_id, callback, issuer };
          await chrome.storage.local.set({ registration });
        }
        const verifier = base64url(crypto.getRandomValues(new Uint8Array(48)));
        const state = base64url(crypto.getRandomValues(new Uint8Array(32)));
        const challenge = base64url(
          new Uint8Array(
            await crypto.subtle.digest(
              "SHA-256",
              new TextEncoder().encode(verifier),
            ),
          ),
        );
        await chrome.storage.session.set({
          flow: {
            verifier,
            state,
            issuer,
            callback,
            expiresAt: Date.now() + 600000,
          },
        });
        const url =
          config.api +
          "/authorize?" +
          new URLSearchParams({
            client_id: registration.id,
            redirect_uri: callback,
            response_type: "code",
            scope: "calendar:read calendar:write",
            resource,
            state,
            code_challenge: challenge,
            code_challenge_method: "S256",
          });
        let result: string | undefined;
        try {
          result = await chrome.identity.launchWebAuthFlow({
            url,
            interactive: true,
          });
        } catch {
          throw new ClientError(
            "LOGIN_CANCELLED",
            "连接窗口已关闭；可重新发起连接",
          );
        }
        const { flow } = (await chrome.storage.session.get("flow")) as {
          flow?: Flow;
        };
        const returned = result ? new URL(result) : null;
        if (
          !flow ||
          flow.expiresAt < Date.now() ||
          !returned ||
          returned.origin + returned.pathname !== callback ||
          returned.searchParams.getAll("state").length !== 1 ||
          returned.searchParams.get("state") !== flow.state ||
          returned.searchParams.getAll("iss").length !== 1 ||
          returned.searchParams.get("iss") !== flow.issuer
        )
          throw new ClientError(
            "INVALID_CALLBACK",
            "授权回调不匹配，请重新连接",
          );
        if (returned.searchParams.has("error"))
          throw new ClientError("LOGIN_CANCELLED", "已取消连接");
        if (returned.searchParams.getAll("code").length !== 1)
          throw new ClientError("INVALID_CALLBACK", "授权码无效");
        const auth = await tokens(
          {
            grant_type: "authorization_code",
            code: returned.searchParams.get("code")!,
            redirect_uri: callback,
            code_verifier: flow.verifier,
          },
          registration.id,
        );
        await chrome.storage.session.remove(["profile", "cache", "draft"]);
        await chrome.storage.session.set({
          auth,
          notice: "已连接。重新打开扩展可查看赛程。",
        });
        if (old) {
          try {
            await revoke(old);
          } catch {
            await chrome.storage.session.set({
              notice: "新连接已生效，旧连接请在网页设置中检查撤销",
            });
          }
        }
      } catch (e) {
        // A previously registered public client may have expired on the server.
        // The next explicit attempt starts with a fresh registration, never an auto-consent retry.
        await chrome.storage.local.remove("registration");
        await chrome.storage.session.set({
          notice: e instanceof ClientError ? e.message : "连接未完成，请重试",
        });
        throw e;
      } finally {
        await chrome.storage.session.remove(["connectingUntil", "flow"]);
      }
    },
  );
  await profile();
  return stateView();
}

async function events(
  from: Date,
  to: Date,
  dataset: Dataset,
  followed: boolean,
  q = "",
) {
  const params = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
    dataset,
    followed: String(followed),
    q,
    limit: "100",
  });
  const items: SportEvent[] = [];
  for (let page = 0; page < 5; page++) {
    const result = await api<EventPage>("/events?" + params);
    items.push(...result.items);
    if (!result.next_cursor) return items;
    params.set("cursor", result.next_cursor);
  }
  throw new ClientError(
    "TOO_MANY_EVENTS",
    "比赛较多，请按日期或名称缩小范围，也可以打开完整日历",
  );
}

function dataset(value: unknown): Dataset {
  if (value !== "real" && !(config.local && value === "demo"))
    throw new ClientError("INVALID_DATASET", "赛程数据类型无效");
  return value;
}

async function handle(message: Message): Promise<unknown> {
  if (!message || typeof message !== "object")
    throw new ClientError("INVALID_MESSAGE", "无效请求");
  switch (message.type) {
    case "state":
      return stateView();
    case "login":
      return login();
    case "logout": {
      return navigator.locks.request("anke-connection", async () => {
        const auth = (await store()).auth;
        let notice = "已退出并清除本机临时数据。";
        try {
          if (auth) await revoke(auth);
        } catch {
          notice = "本机已退出；服务端撤销未确认，请到网页设置撤销应用连接。";
        }
        await forgetAuth(notice);
        return stateView();
      });
    }
    case "schedule": {
      const source = dataset(message.dataset);
      if (typeof message.followed !== "boolean")
        throw new ClientError("INVALID_FILTER", "筛选条件无效");
      const owner = await profile();
      const from = new Date();
      const items = await events(
        from,
        new Date(from.getTime() + 7 * 86400000),
        source,
        message.followed,
      );
      const cache: Cache = {
        ownerId: owner.id,
        items,
        fetchedAt: Date.now(),
        dataset: source,
        followed: message.followed,
      };
      await chrome.storage.local.set({
        preferences: { dataset: source, followed: message.followed },
      });
      await chrome.storage.session.set({ cache, notice: "" });
      return stateView();
    }
    case "current_video": {
      const owner = await profile();
      // action click grants activeTab; this explicit button is the only read site.
      const [tab] = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
      });
      const video = videoFromTab(tab || {});
      const draft: Draft = {
        ...video,
        id: crypto.randomUUID(),
        ownerId: owner.id,
        createdAt: Date.now(),
      };
      await chrome.storage.session.set({ draft });
      return draft;
    }
    case "discard_draft":
      await chrome.storage.session.remove("draft");
      return stateView();
    case "edit_draft": {
      const s = await store(),
        draft = s.draft;
      if (
        !s.auth ||
        !draft ||
        draft.id !== message.draftId ||
        draft.ownerId !== s.profile?.id ||
        Date.now() - draft.createdAt > 86400000
      )
        throw new ClientError("DRAFT_EXPIRED", "草稿已过期，请重新读取视频");
      if (
        typeof message.title !== "string" ||
        message.title.length > 300 ||
        (message.kind &&
          !["preview", "recap", "live", "watch_along"].includes(
            message.kind,
          )) ||
        (message.eventId && !/^[a-zA-Z0-9_-]{1,64}$/.test(message.eventId))
      )
        throw new ClientError("INVALID_INPUT", "草稿内容无效");
      const event = message.eventId
        ? draft.event?.id === message.eventId
          ? draft.event
          : await api<SportEvent>("/events/" + message.eventId)
        : undefined;
      const changed: Draft = {
        ...draft,
        title: message.title,
        kind: message.kind,
        event,
        outcome: undefined,
        error: undefined,
      };
      await chrome.storage.session.set({ draft: changed });
      return changed;
    }
    case "find_events": {
      if (
        typeof message.q !== "string" ||
        message.q.length > 200 ||
        typeof message.date !== "string"
      )
        throw new ClientError("INVALID_QUERY", "查询条件无效");
      let from = new Date(Date.now() - 14 * 86400000),
        to = new Date(Date.now() + 7 * 86400000);
      if (message.date) {
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(message.date) ||
          !Number.isFinite(Date.parse(message.date)) ||
          new Date(message.date).toISOString().slice(0, 10) !== message.date
        )
          throw new ClientError("INVALID_DATE", "请选择有效日期");
        const anchor = Date.parse(message.date + "T00:00:00Z");
        from = new Date(anchor - 86400000);
        to = new Date(anchor + 2 * 86400000);
      }
      return events(
        from,
        to,
        dataset(message.dataset),
        false,
        message.q.trim(),
      );
    }
    case "submit":
      return navigator.locks.request("anke-link-submit", async () => {
        const owner = await profile();
        const s = await store(),
          draft = s.draft;
        if (
          !draft ||
          draft.id !== message.draftId ||
          draft.ownerId !== owner.id ||
          Date.now() - draft.createdAt > 86400000
        )
          throw new ClientError(
            "DRAFT_EXPIRED",
            "草稿已过期，请重新读取当前视频",
          );
        if (
          !/^[a-zA-Z0-9_-]{1,64}$/.test(message.eventId) ||
          typeof message.title !== "string" ||
          message.title.length > 300 ||
          !["preview", "recap", "live", "watch_along"].includes(message.kind)
        )
          throw new ClientError("INVALID_INPUT", "请确认比赛、标题与链接类型");
        const event = await api<SportEvent>("/events/" + message.eventId);
        const payload = {
          url: draft.url,
          title: message.title.trim(),
          kind: message.kind as Kind,
        };
        const fingerprint = JSON.stringify([event.id, payload]);
        const pending: Draft = {
          ...draft,
          title: payload.title,
          event,
          kind: payload.kind,
          fingerprint,
          key:
            fingerprint === draft.fingerprint ? draft.key : crypto.randomUUID(),
          outcome: undefined,
          error: undefined,
        };
        await chrome.storage.session.set({ draft: pending });
        try {
          const result = await api<AddedLink>(
            `/events/${event.id}/links`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Idempotency-Key": pending.key!,
              },
              body: JSON.stringify(payload),
            },
            true,
          );
          const done: Draft = {
            ...pending,
            event: result.event,
            outcome: result.event.links.some((link) => link.id === result.id)
              ? "saved"
              : "hidden",
          };
          await chrome.storage.session.set({ draft: done });
          return done;
        } catch (e) {
          const current = await store();
          if (current.auth && current.profile?.id === owner.id)
            await chrome.storage.session.set({
              draft: {
                ...pending,
                error: "保存结果未确认，重试会复用本次请求。",
              },
            });
          throw e;
        }
      });
    case "open_web": {
      if (
        !["calendar", "following", "settings"].includes(message.page) ||
        (message.eventId && !/^[a-zA-Z0-9_-]{1,64}$/.test(message.eventId))
      )
        throw new ClientError("INVALID_DESTINATION", "页面地址无效");
      const url = new URL("/" + message.page, config.web);
      if (message.eventId) url.searchParams.set("event", message.eventId);
      await chrome.tabs.create({ url: url.href });
      return { opened: true };
    }
    default:
      throw new ClientError("INVALID_MESSAGE", "不支持的请求");
  }
}

// No page/content-script bridge and no background tab/history listeners.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (
    sender.id !== chrome.runtime.id ||
    sender.url !== chrome.runtime.getURL("popup.html")
  ) {
    sendResponse({
      ok: false,
      code: "UNTRUSTED_SENDER",
      message: "请求来源不受支持",
    });
    return false;
  }
  void (async () => {
    try {
      const data =
        message?.type === "state" || message?.type === "open_web"
          ? await handle(message)
          : await navigator.locks.request("anke-session-action", () =>
              handle(message),
            );
      sendResponse({ ok: true, data });
    } catch (e) {
      sendResponse({
        ok: false,
        code: e instanceof ClientError ? e.code : "REQUEST_FAILED",
        message:
          e instanceof ClientError
            ? e.message
            : "操作未完成，请重新打开扩展后重试",
      });
    }
  })();
  return true;
});
