import type { components } from "../../src/lib/generated";

export type CalendarUser = components["schemas"]["CalendarUserView"];
export type SportEvent = components["schemas"]["EventView"];
export type EventPage = components["schemas"]["EventList"];
export type AddedLink = components["schemas"]["LinkAddedView"];
export type Kind = "preview" | "recap" | "live" | "watch_along";
export type Dataset = "real" | "demo";

declare const ANKE_BUILD_CONFIG: { api: string; web: string; local: boolean };
export const config = ANKE_BUILD_CONFIG;
export const resource = config.api + "/api/v1";
export const issuer = new URL(config.api + "/").href;

export class ClientError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export type Profile = { id: string; display_name: string; timezone: string };
export type Draft = {
  id: string;
  ownerId: string;
  url: string;
  title: string;
  createdAt: number;
  event?: SportEvent;
  kind?: Kind;
  key?: string;
  fingerprint?: string;
  outcome?: "saved" | "hidden";
  error?: string;
};
export type Cache = {
  ownerId: string;
  items: SportEvent[];
  fetchedAt: number;
  dataset: Dataset;
  followed: boolean;
};
export type ViewState = {
  connected: boolean;
  canWrite: boolean;
  connecting: boolean;
  local: boolean;
  profile: Profile | null;
  cache: Cache | null;
  draft: Draft | null;
  preferences: { dataset: Dataset; followed: boolean };
  notice: string;
};
export type Message =
  | { type: "state" }
  | { type: "login" }
  | { type: "logout" }
  | { type: "schedule"; dataset: Dataset; followed: boolean }
  | { type: "current_video" }
  | { type: "discard_draft" }
  | {
      type: "edit_draft";
      draftId: string;
      title: string;
      kind?: Kind;
      eventId?: string;
    }
  | { type: "find_events"; q: string; date: string; dataset: Dataset }
  | {
      type: "submit";
      draftId: string;
      eventId: string;
      title: string;
      kind: Kind;
    }
  | {
      type: "open_web";
      page: "calendar" | "following" | "settings";
      eventId?: string;
    };
export type Reply<T> =
  { ok: true; data: T } | { ok: false; code: string; message: string };

export async function send<T>(message: Message): Promise<T> {
  const reply: Reply<T> = await chrome.runtime.sendMessage(message);
  if (!reply?.ok)
    throw new ClientError(
      reply?.code || "WORKER_UNAVAILABLE",
      reply?.message || "扩展未响应，请重新打开弹窗",
    );
  return reply.data;
}

export function videoFromTab(tab: { url?: string; title?: string }): {
  url: string;
  title: string;
} {
  if (!tab.url)
    throw new ClientError(
      "TAB_PERMISSION",
      "请在 YouTube 视频页面重新点击工具栏中的 Anke Sports 图标",
    );
  let parsed: URL;
  try {
    parsed = new URL(tab.url);
  } catch {
    throw new ClientError("NOT_VIDEO", "请打开具体的 YouTube 视频页面");
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    !["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"].includes(
      parsed.hostname,
    )
  )
    throw new ClientError(
      "NOT_VIDEO",
      "当前不是 YouTube 视频页面，请打开视频后重新点击扩展图标",
    );
  const parts = parsed.pathname.split("/").filter(Boolean);
  const id =
    parsed.hostname === "youtu.be"
      ? parts[0]
      : parsed.pathname === "/watch"
        ? parsed.searchParams.get("v")
        : ["shorts", "live", "embed"].includes(parts[0])
          ? parts[1]
          : "";
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id))
    throw new ClientError(
      "NOT_VIDEO",
      "请选择具体视频；频道或首页不能附加到比赛",
    );
  // Send only the selected video's canonical URL, never tracking or search parameters.
  return {
    url: `https://www.youtube.com/watch?v=${id}`,
    title: (tab.title || "YouTube 视频")
      .replace(/\s*-\s*YouTube$/, "")
      .trim()
      .slice(0, 300),
  };
}

export function dateLabel(event: SportEvent, timezone: string) {
  if (!event.starts_at) return `${event.local_date || "日期待定"} · 时间待定`;
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: timezone,
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(event.starts_at));
}
