import { send, dateLabel } from "./shared";
import type {
  Cache,
  Dataset,
  Draft,
  Kind,
  Message,
  SportEvent,
  ViewState,
} from "./shared";

const main = document.getElementById("main")!;
const account = document.getElementById("account")!;
const feedback = document.getElementById("feedback")!;
let view: ViewState | null = null;
let busy = false;
let scheduleFailed = false;
let matches: SportEvent[] = [];
let mode: "calendar" | "draft" = "calendar";

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text = "",
  className = "",
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.textContent = text;
  element.className = className;
  return element;
}
function button(text: string, action: () => void, className = "") {
  const b = el("button", text, className);
  b.type = "button";
  b.addEventListener("click", action);
  return b;
}
function tell(text: string, success = false) {
  feedback.textContent = text;
  feedback.hidden = !text;
  feedback.className = "feedback" + (success ? " success" : "");
}
function showBusy(value: boolean) {
  busy = value;
  main.setAttribute("aria-busy", String(value));
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    "button:not(#open-calendar)",
  ))
    button.disabled = value || button.dataset.unavailable === "true";
}
async function act<T>(message: Message, after?: (result: T) => void) {
  if (busy) return;
  showBusy(true);
  tell("");
  try {
    const result = await send<T>(message);
    after?.(result);
  } catch (e) {
    if (message.type === "schedule") scheduleFailed = true;
    tell(e instanceof Error ? e.message : "操作未完成，请重试");
    try {
      view = await send<ViewState>({ type: "state" });
      if (!view.connected || message.type === "schedule") render();
    } catch {
      /* keep existing UI */
    }
  } finally {
    showBusy(false);
  }
}
async function openWeb(
  page: "calendar" | "following" | "settings",
  eventId?: string,
) {
  try {
    await send({ type: "open_web", page, eventId });
    window.close();
  } catch (e) {
    tell(e instanceof Error ? e.message : "无法打开完整日历");
  }
}
document.getElementById("open-calendar")!.addEventListener("click", () => {
  void openWeb("calendar");
});

function renderAccount() {
  account.replaceChildren();
  const avatar = el("span", view?.connected ? "A" : "○", "avatar");
  const identity = el(
    "div",
    view?.profile?.display_name ||
      (view?.connected ? "已连接账号" : "还未连接"),
  );
  identity.append(
    el(
      "small",
      view?.connecting
        ? "请在授权窗口完成连接"
        : view?.connected
          ? view.canWrite
            ? "可查看日历与管理链接"
            : "仅允许查看日历"
          : "连接后查看你的关注与赛程",
    ),
  );
  account.append(avatar, identity);
  if (view?.connected) {
    const logout = button("退出", () => {
      void act<ViewState>({ type: "logout" }, (result) => {
        view = result;
        mode = "calendar";
        render();
        tell(result.notice);
      });
    });
    logout.setAttribute("aria-label", "退出并撤销扩展连接");
    account.append(logout);
  }
}

function render() {
  if (!view) return;
  document.getElementById("environment")!.textContent = view.local
    ? "本地体验"
    : "";
  renderAccount();
  main.replaceChildren();
  main.classList.toggle(
    "calendar-view",
    view.connected && !(mode === "draft" && view.draft),
  );
  if (!view.connected) {
    const welcome = el("section", "", "welcome");
    welcome.append(
      el("h1", "下一场热爱，\n在这里。"),
      el("p", "查看近期赛程，把你正在看的 YouTube 前瞻与复盘附到同一场比赛。"),
    );
    const login = button(
      view.connecting ? "正在连接…" : "连接 Anke Sports",
      () => {
        void connect();
      },
      "primary wide",
    );
    login.dataset.unavailable = String(view.connecting);
    login.disabled = view.connecting;
    welcome.append(
      login,
      el("p", "在网页确认账号与权限，完成后重新打开扩展。", "stamp"),
    );
    main.append(welcome);
  } else if (mode === "draft" && view.draft) renderDraft(view.draft);
  else renderCalendar();
  main.setAttribute("aria-busy", "false");
}

function renderCalendar() {
  const s = view!;
  const header = el("div", "", "section-head");
  const heading = el("div");
  heading.append(
    el("h2", "未来 7 天"),
    el("small", s.profile?.timezone || "正在读取时区"),
  );
  const reload = button(
    "↻",
    () => {
      void refresh();
    },
    "refresh",
  );
  reload.setAttribute("aria-label", "刷新近期赛程");
  header.append(heading, reload);
  main.append(header);
  const filters = el("div", "", "filters"),
    segments = el("div", "", "segments");
  for (const [label, followed] of [
    ["我的关注", true],
    ["全部赛事", false],
  ] as const) {
    const b = button(
      label,
      () => {
        void refresh(s.preferences.dataset, followed);
      },
      followed === s.preferences.followed ? "selected" : "",
    );
    b.setAttribute("aria-pressed", String(followed === s.preferences.followed));
    segments.append(b);
  }
  filters.append(segments);
  if (s.local) {
    const select = el("select");
    select.setAttribute("aria-label", "赛程数据");
    for (const [value, name] of [
      ["demo", "演示赛程"],
      ["real", "真实赛程"],
    ]) {
      const option = el("option", name);
      option.value = value;
      select.append(option);
    }
    select.value = s.preferences.dataset;
    select.addEventListener("change", () => {
      void refresh(select.value as Dataset);
    });
    filters.append(select);
  }
  main.append(filters);
  const games = el("div", "", "games-scroll");
  games.tabIndex = 0;
  games.setAttribute("role", "region");
  games.setAttribute("aria-label", "近期比赛列表");
  main.append(games);
  if (s.cache) renderGames(s.cache, games);
  else
    games.append(
      el(
        "p",
        scheduleFailed
          ? "未能读取赛程，请点击上方刷新按钮重试。"
          : "正在读取赛程…",
        "empty",
      ),
    );
  const reading = el("section", "", "read-video");
  reading.append(
    el("h3", "给比赛附一条原链接"),
    el("p", "点击后才读取当前 YouTube 视频的标题和链接。"),
  );
  reading.append(
    button(s.draft ? "继续视频草稿" : "读取当前视频", () => {
      if (s.draft) {
        mode = "draft";
        render();
      } else
        void act<Draft>({ type: "current_video" }, (draft) => {
          view!.draft = draft;
          matches = [];
          mode = "draft";
          render();
        });
    }),
  );
  if (!s.canWrite)
    reading.append(
      button(
        "重新连接并允许管理链接",
        () => {
          void connect();
        },
        "text-button",
      ),
    );
  main.append(reading);
}

function renderGames(cache: Cache, container: HTMLElement) {
  const timezone = view!.profile?.timezone || "UTC";
  if (!cache.items.length) {
    container.append(
      el(
        "p",
        cache.followed
          ? "未来 7 天没有已关注的比赛。\n可以添加关注，或查看全部赛事。"
          : "当前数据源没有这一周的比赛。",
        "empty",
      ),
    );
    if (cache.followed)
      container.append(
        button(
          "管理我的关注 ↗",
          () => {
            void openWeb("following");
          },
          "text-button",
        ),
      );
  }
  let previousDay = "";
  for (const event of cache.items) {
    const day = event.starts_at
      ? new Intl.DateTimeFormat("zh-CN", {
          timeZone: timezone,
          month: "long",
          day: "numeric",
          weekday: "short",
        }).format(new Date(event.starts_at))
      : event.local_date || "日期待定";
    if (day !== previousDay) {
      container.append(el("h3", day));
      previousDay = day;
    }
    const row = button(
      "",
      () => {
        void openWeb("calendar", event.id);
      },
      "game",
    );
    const time = event.starts_at
      ? new Intl.DateTimeFormat("zh-CN", {
          timeZone: timezone,
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(new Date(event.starts_at))
      : "待定";
    row.append(el("span", time, "time"));
    const detail = el("span", "", "detail");
    detail.append(
      el("strong", event.title),
      el(
        "small",
        `${event.sport === "basketball" ? "篮球" : event.sport === "football" ? "足球" : "赛车"}${event.status === "cancelled" ? " · 已取消" : event.status === "postponed" ? " · 已延期" : ""}${event.demo ? " · 演示" : ""}`,
      ),
    );
    row.append(detail, el("span", "›", "chevron"));
    container.append(row);
  }
  container.append(
    el(
      "p",
      `上次读取 ${new Date(cache.fetchedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })} · ${cache.dataset === "demo" ? "合成赛程，不代表真实比赛" : "仅展示已接入数据源的赛程"}`,
      "stamp",
    ),
  );
}

async function refresh(
  dataset = view!.preferences.dataset,
  followed = view!.preferences.followed,
) {
  scheduleFailed = false;
  await act<ViewState>({ type: "schedule", dataset, followed }, (next) => {
    view = next;
    if (mode === "calendar") render();
  });
}

async function connect() {
  await act<ViewState>({ type: "login" }, (result) => {
    view = result;
    mode = "calendar";
    render();
  });
  if (view?.connected) await refresh();
}

function renderDraft(draft: Draft) {
  const top = el("div", "", "draft-top");
  const back = button(
    "‹",
    () => {
      mode = "calendar";
      render();
    },
    "back",
  );
  back.setAttribute("aria-label", "返回近期赛程");
  top.append(back, el("h2", "附加视频"));
  main.append(top);
  if (draft.outcome) {
    const done = el("section", "", "saved");
    done.append(
      el("span", draft.outcome === "saved" ? "✓" : "—", "check"),
      el("h2", draft.outcome === "saved" ? "原链接已保存" : "视频仍保持隐藏"),
    );
    done.append(
      el(
        "p",
        draft.outcome === "hidden"
          ? "你之前移除了这个视频，它没有被重新加入。"
          : draft.event?.included
            ? "后台会更新你的订阅源。系统日历何时显示，取决于它的刷新。"
            : "这场比赛尚未加入你的个人日历，可以在完整日历中选择关注。",
      ),
    );
    done.append(
      el("p", draft.event?.title || ""),
      button(
        "查看这场比赛 ↗",
        () => {
          void openWeb("calendar", draft.event?.id);
        },
        "primary wide",
      ),
    );
    done.append(
      button(
        "完成，返回赛程",
        () => {
          void act<ViewState>({ type: "discard_draft" }, (next) => {
            view = next;
            mode = "calendar";
            render();
          });
        },
        "text-button",
      ),
    );
    main.append(done);
    return;
  }
  const card = el("div", "", "video-card");
  card.append(el("small", "YOUTUBE · 原始视频"));
  const titleLabel = el("label", "视频标题");
  titleLabel.htmlFor = "video-title";
  const title = el("input");
  title.id = "video-title";
  title.value = draft.title;
  title.maxLength = 300;
  card.append(titleLabel, title, el("p", draft.url, "video-url"));
  main.append(card);
  const searchLabel = el("label", "选择对应比赛", "search-label");
  searchLabel.htmlFor = "event-query";
  const searchForm = el("form");
  const searchRow = el("div", "", "search-row"),
    search = el("input");
  search.id = "event-query";
  search.placeholder = "球队或赛事名称";
  search.maxLength = 200;
  const searchButton = el("button", "查找");
  searchButton.type = "submit";
  searchRow.append(search, searchButton);
  const dateRow = el("label", "日期附近", "date-row"),
    date = el("input");
  date.type = "date";
  date.setAttribute("aria-label", "比赛日期附近");
  dateRow.append(date);
  searchForm.append(searchRow, dateRow);
  main.append(
    searchLabel,
    searchForm,
    el("p", "未选日期时查最近两周与未来 7 天。", "stamp"),
  );
  const list = el("div", "", "match-list");
  list.setAttribute("role", "radiogroup");
  list.setAttribute("aria-label", "选择比赛");
  main.append(list);
  const chosen = el("div", "", "chosen");
  const kindLabel = el("label", "这条链接是什么？", "kind-label");
  kindLabel.htmlFor = "link-kind";
  const kind = el("select");
  kind.id = "link-kind";
  for (const [value, name] of [
    ["", "请选择类型"],
    ["preview", "赛前前瞻"],
    ["recap", "赛后复盘"],
    ["live", "观看直播"],
    ["watch_along", "陪看 / 解说"],
  ]) {
    const option = el("option", name);
    option.value = value;
    kind.append(option);
  }
  kind.value = draft.kind || "";
  let selected = draft.event;
  async function persist() {
    try {
      const next = await send<Draft>({
        type: "edit_draft",
        draftId: draft.id,
        title: title.value,
        kind: (kind.value as Kind) || undefined,
        eventId: selected?.id,
      });
      view!.draft = next;
    } catch (e) {
      tell(e instanceof Error ? e.message : "草稿未保存");
    }
  }
  function selectionText() {
    chosen.replaceChildren();
    chosen.append(el("strong", selected ? selected.title : "还没有选择比赛"));
    if (selected)
      chosen.append(
        el("div", dateLabel(selected, view!.profile?.timezone || "UTC")),
      );
    save.dataset.unavailable = String(
      !selected || !kind.value || !view!.canWrite,
    );
    save.disabled = busy || save.dataset.unavailable === "true";
  }
  function showMatches() {
    list.replaceChildren();
    for (const event of matches) {
      const label = el("label", "", "match"),
        radio = el("input");
      radio.type = "radio";
      radio.name = "event";
      radio.value = event.id;
      radio.checked = selected?.id === event.id;
      const description = el("span");
      description.append(
        el("strong", event.title),
        el(
          "small",
          dateLabel(event, view!.profile?.timezone || "UTC") +
            (event.demo ? " · 演示" : ""),
        ),
      );
      radio.addEventListener("change", () => {
        selected = event;
        selectionText();
        void persist();
      });
      label.append(radio, description);
      list.append(label);
    }
  }
  searchForm.addEventListener("submit", (e) => {
    e.preventDefault();
    void act<SportEvent[]>(
      {
        type: "find_events",
        q: search.value,
        date: date.value,
        dataset: view!.preferences.dataset,
      },
      (found) => {
        matches = found;
        showMatches();
        if (!found.length) tell("没有找到比赛，请调整名称或日期。");
      },
    );
  });
  title.addEventListener("change", () => {
    void persist();
  });
  kind.addEventListener("change", () => {
    selectionText();
    void persist();
  });
  main.append(chosen, kindLabel, kind);
  const actions = el("div", "", "actions");
  const save = button(
    "确认并保存链接",
    () => {
      if (!selected || !kind.value) return;
      void act<Draft>(
        {
          type: "submit",
          draftId: draft.id,
          eventId: selected.id,
          title: title.value,
          kind: kind.value as Kind,
        },
        (done) => {
          view!.draft = done;
          render();
        },
      );
    },
    "primary",
  );
  actions.append(
    save,
    button("丢弃草稿", () => {
      void act<ViewState>({ type: "discard_draft" }, (next) => {
        view = next;
        mode = "calendar";
        render();
      });
    }),
  );
  main.append(actions);
  if (!view!.canWrite)
    main.append(
      button(
        "重新连接并允许管理链接",
        () => {
          void connect();
        },
        "text-button",
      ),
    );
  if (draft.error) main.append(el("p", draft.error, "stamp"));
  selectionText();
  showMatches();
}

async function initialize() {
  try {
    view = await send<ViewState>({ type: "state" });
    mode = view.draft ? "draft" : "calendar";
    render();
    if (view.notice) tell(view.notice, view.connected);
    if (view.connected && !view.connecting && mode === "calendar")
      await refresh();
  } catch (e) {
    tell(e instanceof Error ? e.message : "无法打开扩展");
    main.replaceChildren(el("p", "请关闭并重新打开扩展。", "empty"));
  }
}
void initialize();
