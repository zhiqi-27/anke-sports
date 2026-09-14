"use client";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Basketball,
  CalendarBlank,
  Star,
  YoutubeLogo,
  Broadcast,
  GearSix,
  GithubLogo,
  ArrowUpRight,
  Plus,
  CaretRight,
  X,
  GlobeHemisphereWest,
  Check,
  LinkSimple,
  MapPin,
  Clock,
  Copy,
  DownloadSimple,
  ShieldCheck,
  ArrowClockwise,
  Pause,
  Play,
  SignIn,
  SignOut,
  Code,
  EyeSlash,
  PushPin,
  FlagCheckered,
  CalendarCheck,
  WarningCircle,
  SoccerBall,
  SlidersHorizontal,
} from "@phosphor-icons/react";
import { api, deleteAccount, download, logout } from "@/lib/api";
import type {
  Config,
  Follow,
  ImportPreview,
  Preferences,
  Source,
  SportEvent,
} from "@/lib/types";
import { BroadcastManager } from "./broadcast-manager";
import { PublicSubscription } from "./public-subscription";
import { FollowPreview } from "./follow-preview";
import { CreatorManager } from "./creator-manager";
import { ConnectionManager } from "./connections";
import { GoogleSignIn } from "./google-sign-in";
import { useAnke } from "@/hooks/use-anke";
import { TeamMark, leagueOf, timeOf } from "./calendar-view";

const CalendarView = dynamic(() => import("./calendar-view"), {
  ssr: false,
  loading: () => (
    <div className="loading-calendar">
      <span className="loader" />
      正在准备日历
    </div>
  ),
});
const navigation = [
  { id: "calendar", label: "日历", icon: CalendarBlank },
  { id: "following", label: "我的关注", icon: Star },
  { id: "creators", label: "创作者", icon: YoutubeLogo },
  { id: "subscription", label: "日历订阅", icon: Broadcast },
  { id: "settings", label: "设置", icon: GearSix },
];
const pageInfo: Record<string, [string, string]> = {
  calendar: ["比赛日历", ""],
  following: ["我的关注", "选择球队或赛事。"],
  creators: ["创作者", "把 YouTube 原视频链接附到对应比赛。"],
  subscription: ["日历订阅", "复制地址，在 Apple 或 Google 日历中添加。"],
  settings: ["设置", ""],
  maintenance: ["直播入口维护", "核对来源、场次与兼容性证据。"],
};

function canFollowDirectly(source: Source) {
  return (
    source.kind === "team" ||
    (source.kind === "competition" && source.sport === "racing")
  );
}

function FollowSourceCard({
  source,
  checked,
  onToggle,
}: {
  source: Source;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      className={`source-card ${checked ? "chosen" : ""}`}
      onClick={onToggle}
      aria-pressed={checked}
    >
      <TeamMark
        short={source.short_name}
        color={source.color}
        logoUrl={source.logo_url}
      />
      <span>
        <b>{source.name}</b>
        <small>
          {source.sport === "basketball"
            ? "篮球"
            : source.sport === "football"
              ? "足球"
              : "赛车"}
          {source.demo ? " · 演示" : ""}
        </small>
      </span>
      <span className="check-circle">
        {checked ? <Check size={14} /> : <Plus size={14} />}
      </span>
    </button>
  );
}

function Modal({
  children,
  onClose,
  title,
  drawer = false,
  wide = false,
}: {
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  onClose: () => void;
  title: string;
  drawer?: boolean;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [phase, setPhase] = useState<"opening" | "open" | "closing">("opening");
  const requestClose = useCallback(() => {
    if (phase === "closing") return;
    setPhase("closing");
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches
      ? 80
      : 200;
    closeTimer.current = setTimeout(onClose, duration);
  }, [onClose, phase]);
  useEffect(() => {
    const el = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    el?.showModal();
    const frame = requestAnimationFrame(() => setPhase("open"));
    return () => {
      cancelAnimationFrame(frame);
      if (closeTimer.current) clearTimeout(closeTimer.current);
      el?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      className={`${drawer ? "drawer-dialog" : `modal${wide ? " modal-wide" : ""}`} is-${phase}`}
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div className="dialog-inside">
        {typeof children === "function" ? children(requestClose) : children}
      </div>
    </dialog>
  );
}

export function Dashboard({ page }: { page: string }) {
  const state = useAnke();
  const {
    user,
    accountReady,
    sources,
    dataset,
    status,
    epoch,
    busy,
    error,
    setError,
    run,
    refresh,
  } = state;
  const [timezone, setTimezone] = useState("Asia/Shanghai");
  const [selected, setSelected] = useState<SportEvent | null>(null);
  const [login, setLogin] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState("");
  const [toastClosing, setToastClosing] = useState(false);
  const [followDraft, setFollowDraft] = useState<Follow[]>([]);
  const [followReview, setFollowReview] = useState<{
    follows: Follow[];
    revision: number;
  } | null>(null);
  const [followSaving, setFollowSaving] = useState(false);
  const pendingGuestFollows = useRef<Follow[] | null>(null);
  const [followSearch, setFollowSearch] = useState("");
  const [selectedLeagueId, setSelectedLeagueId] = useState("");
  const followableSources = useMemo(
    () => sources.filter(canFollowDirectly),
    [sources],
  );
  const leagueDirectories = useMemo(
    () =>
      sources.filter(
        (source) =>
          source.kind === "competition" &&
          source.sport !== "racing" &&
          sources.some(
            (candidate) =>
              candidate.kind === "team" && candidate.sport === source.sport,
          ),
      ),
    [sources],
  );
  const [preferences, setPreferences] = useState<Preferences>({
    timezone: "Asia/Shanghai",
    locale: "zh-CN",
    watch_region: null,
    spoiler_free: true,
    transparent: true,
  });
  const [importText, setImportText] = useState("");
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(
    null,
  );
  const [importMode, setImportMode] = useState("merge");
  const [confirm, setConfirm] = useState<"rotate" | "delete" | null>(null);
  const [accountNotice, setAccountNotice] = useState("");
  const previousAccount = useRef<string | null>(null);
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("anke-account-deleted");
      sessionStorage.removeItem("anke-account-deleted");
      if (saved) {
        const result = JSON.parse(saved);
        setAccountNotice(
          "账号数据已删除。请在系统日历中移除旧订阅。" +
            (result.identity_cleanup === "queued"
              ? "登录账号正在后台清理。"
              : "") +
            (result.sessionCleared === false
              ? "浏览器退出未完成，请关闭此窗口。"
              : ""),
        );
      }
    } catch {
      /* Storage can be unavailable; deletion has already completed. */
    }
  }, []);
  useEffect(() => {
    if (previousAccount.current && previousAccount.current !== user?.id) {
      setSelected(null);
      setFollowDraft([]);
      setFollowReview(null);
      setImportText("");
      setImportPreview(null);
      setImportMode("merge");
      setFollowSearch("");
      setSelectedLeagueId("");
      setFollowSaving(false);
      setAdding(false);
      setConfirm(null);
      setTimezone("Asia/Shanghai");
      setPreferences({
        timezone: "Asia/Shanghai",
        locale: "zh-CN",
        watch_region: null,
        spoiler_free: true,
        transparent: true,
      });
      pendingGuestFollows.current = null;
    }
    previousAccount.current = user?.id ?? null;
  }, [user?.id]);
  const flash = useCallback((text: string) => {
    setToastClosing(false);
    setToast(text);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const exitTimer = setTimeout(() => setToastClosing(true), 4000);
    const removeTimer = setTimeout(() => setToast(""), 4200);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(removeTimer);
    };
  }, [toast]);
  useEffect(() => {
    if (user) {
      setTimezone(user.config.preferences.timezone);
      setPreferences(user.config.preferences);
      setFollowDraft(
        pendingGuestFollows.current
          ? Array.from(
              new Map(
                [...user.config.follows, ...pendingGuestFollows.current].map(
                  (f) => [f.source_key, f],
                ),
              ).values(),
            )
          : user.config.follows,
      );
      pendingGuestFollows.current = null;
    }
  }, [user?.revision, user?.id]); // Preferences refresh only after authoritative configuration changes.
  useEffect(() => {
    if (!sources.length) return;
    const blocked = new Set(
      sources
        .filter((source) => !canFollowDirectly(source))
        .map((source) => source.id),
    );
    setFollowDraft((current) =>
      current.filter((follow) => !blocked.has(follow.source_key)),
    );
  }, [sources]);
  useEffect(() => {
    if (
      selectedLeagueId &&
      !leagueDirectories.some((league) => league.id === selectedLeagueId)
    )
      setSelectedLeagueId("");
  }, [leagueDirectories, selectedLeagueId]);
  const openEvent = useCallback((event: SportEvent) => {
    setSelected(event);
    const url = new URL(window.location.href);
    url.searchParams.set("event", event.id);
    window.history.replaceState(null, "", url);
  }, []);
  const closeEvent = () => {
    setSelected(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("event");
    window.history.replaceState(null, "", url);
  };
  useEffect(() => {
    const id = new URL(window.location.href).searchParams.get("event");
    if (id)
      api<SportEvent>(`/events/${id}`)
        .then(setSelected)
        .catch(() => {});
  }, [epoch]);
  const requireUser = (action: () => void) => {
    if (user) action();
    else {
      if (page === "following") pendingGuestFollows.current = followDraft;
      setLogin(true);
    }
  };
  const toggleFollow = (source: Source) =>
    setFollowDraft((current) =>
      current.some((x) => x.source_key === source.id)
        ? current.filter((x) => x.source_key !== source.id)
        : [
            ...current,
            { type: source.kind as Follow["type"], source_key: source.id },
          ],
    );
  const followChanged =
    JSON.stringify(
      [...followDraft].sort((a, b) => a.source_key.localeCompare(b.source_key)),
    ) !==
    JSON.stringify(
      [...(user?.config.follows || [])].sort((a, b) =>
        a.source_key.localeCompare(b.source_key),
      ),
    );
  const mutate = (path: string, method: string, data?: unknown) =>
    api(path, {
      method,
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  const reloadEvent = async () => {
    if (selected) setSelected(await api<SportEvent>(`/events/${selected.id}`));
    refresh();
  };
  const savedMessage = () => flash("已保存，订阅源更新中");
  if (!accountReady) {
    return (
      <div className="boot-screen" role="status" aria-live="polite">
        <span className="brand-icon">
          <Basketball weight="duotone" size={26} />
        </span>
        <span className="loader" />
        <span>正在准备你的体育日历</span>
      </div>
    );
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        跳到主要内容
      </a>
      <aside className="sidebar">
        <Link href="/calendar" className="brand" aria-label="Anke Sports 首页">
          <span className="brand-icon">
            <Basketball weight="duotone" size={26} />
          </span>
          <span>
            Anke <b>Sports</b>
          </span>
        </Link>
        <div className="workspace-label">你的体育日历</div>
        <nav aria-label="主导航">
          {navigation.map((item) => (
            <Link
              key={item.id}
              href={`/${item.id}`}
              className={`nav-item ${page === item.id ? "selected" : ""}`}
              aria-current={page === item.id ? "page" : undefined}
            >
              <item.icon
                size={20}
                weight={page === item.id ? "fill" : "regular"}
              />
              <span>{item.label}</span>
              {item.id === "creators" && user && user.creators.length > 0 && (
                <small>{user.creators.length}</small>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-follows">
          <div className="sidebar-heading">
            <span>我的球队与赛事</span>
            <Link href="/following" aria-label="添加关注">
              <Plus size={16} />
            </Link>
          </div>
          {user &&
          sources.filter((s) =>
            user.config.follows.some((f) => f.source_key === s.id),
          ).length ? (
            sources
              .filter((s) =>
                user.config.follows.some((f) => f.source_key === s.id),
              )
              .slice(0, 7)
              .map((s) => (
                <div key={s.id} className="mini-follow">
                  <TeamMark
                    short={s.short_name}
                    color={s.color}
                    logoUrl={s.logo_url}
                    small
                  />
                  <span>{s.name}</span>
                </div>
              ))
          ) : (
            <div className="sidebar-empty">
              <span>尚未关注球队或赛事。</span>
              <Link href="/following">
                添加你喜欢的球队 <Plus size={12} />
              </Link>
            </div>
          )}
        </div>
        <div className="sidebar-bottom">
          {user?.is_maintainer && (
            <Link className="sidebar-docs" href="/maintenance">
              <ShieldCheck size={17} />
              直播入口维护
              <CaretRight size={12} />
            </Link>
          )}
          <Link className="sidebar-docs" href="/settings">
            <Code size={17} />
            MCP 与连接
            <CaretRight size={12} />
          </Link>
          <a
            className="sidebar-docs"
            href="https://github.com/zhiqi-27/anke-sports"
            target="_blank"
            rel="noopener noreferrer"
          >
            <GithubLogo size={17} />
            开源项目
            <ArrowUpRight size={12} />
          </a>
          <button
            className="account-button"
            aria-haspopup={user ? "dialog" : undefined}
            aria-expanded={user ? accountOpen : undefined}
            onClick={() => (user ? setAccountOpen(true) : setLogin(true))}
          >
            <span className="avatar">{user ? "A" : <SignIn size={20} />}</span>
            <span>
              <b>{user?.display_name || "登录 Anke Sports"}</b>
              <small>
                {user
                  ? status?.local_preview
                    ? "仅本机体验"
                    : "个人日历"
                  : "保存你的关注与订阅"}
              </small>
            </span>
            {user && <SignOut size={15} />}
          </button>
        </div>
      </aside>
      <main className="main-content" id="main-content" tabIndex={-1}>
        <header className="topbar">
          <div className="breadcrumb">
            <span>Anke Sports</span>
            <CaretRight size={12} />
            <b>{navigation.find((n) => n.id === page)?.label}</b>
          </div>
          <div className="topbar-actions">
            <GlobeHemisphereWest size={16} />
            <select
              aria-label="临时显示时区（不保存）"
              title="仅改变当前页面显示；默认时区请在设置中保存"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
            >
              {[
                "Asia/Shanghai",
                "America/New_York",
                "America/Los_Angeles",
                "Europe/London",
                "Europe/Paris",
                "Asia/Tokyo",
                "UTC",
              ].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <Link className="primary-button" href="/subscription">
              <CalendarCheck size={17} />
              订阅日历
            </Link>
          </div>
        </header>
        {accountNotice && (
          <div className="account-notice" role="status">
            {accountNotice}
          </div>
        )}
        <div className="page-heading">
          <div>
            <h1>{pageInfo[page][0]}</h1>
            {pageInfo[page][1] && <p>{pageInfo[page][1]}</p>}
          </div>
          <div className="dataset-control">
            {status?.local_preview ? (
              <>
                <span className={dataset === "demo" ? "demo-dot" : ""}>
                  {dataset === "demo" ? "演示数据" : "已接入赛程"}
                </span>
                <select
                  aria-label="赛程数据"
                  value={dataset}
                  onChange={(e) => state.changeDataset(e.target.value)}
                >
                  <option value="demo">演示赛程</option>
                  <option value="real">真实赛程</option>
                </select>
              </>
            ) : (
              <span>已接入赛事</span>
            )}
          </div>
        </div>
        {error && (
          <div className="error-banner" role="alert">
            <WarningCircle size={19} />
            <span>{error}</span>
            <button aria-label="关闭错误提示" onClick={() => setError("")}>
              <X size={17} />
            </button>
          </div>
        )}
        {page === "maintenance" && (
          <BroadcastManager user={user} dataset={dataset} />
        )}
        {page === "calendar" && (
          <CalendarView
            dataset={dataset}
            timezone={timezone}
            sources={sources}
            epoch={epoch}
            signedIn={!!user}
            onEvent={openEvent}
            onFollowing={() => {
              window.location.href = "/following";
            }}
          />
        )}
        {page === "following" && (
          <div className="management-page">
            <div className="section-toolbar">
              <div>
                <h2>球队与赛事</h2>
                <p>F1 可整体关注；英超、NBA 请选择球队。</p>
              </div>
              <button
                className="primary-button"
                disabled={busy || (!!user && !followChanged)}
                onClick={() =>
                  requireUser(() =>
                    setFollowReview({
                      follows: [...followDraft],
                      revision: user!.revision,
                    }),
                  )
                }
              >
                <Check size={16} />
                {!user ? "保存我的关注" : followChanged ? "预览变更" : "已保存"}
              </button>
            </div>
            <label className="search-field">
              <span className="sr-only">搜索球队或赛事</span>
              <SlidersHorizontal size={18} />
              <input
                value={followSearch}
                onChange={(e) => setFollowSearch(e.target.value)}
                placeholder="搜索球队或赛事"
              />
            </label>
            <section className="source-section">
              <h3>
                关注赛事
                <small>
                  {
                    followableSources.filter(
                      (source) => source.kind === "competition",
                    ).length
                  }
                </small>
              </h3>
              <div className="source-grid">
                {followableSources
                  .filter(
                    (source) =>
                      source.kind === "competition" &&
                      (source.name + source.short_name)
                        .toLowerCase()
                        .includes(followSearch.toLowerCase()),
                  )
                  .map((source) => (
                    <FollowSourceCard
                      key={source.id}
                      source={source}
                      checked={followDraft.some(
                        (follow) => follow.source_key === source.id,
                      )}
                      onToggle={() => toggleFollow(source)}
                    />
                  ))}
              </div>
            </section>
            <section className="source-section">
              <h3>
                按联赛选择球队
                <small>
                  {
                    followableSources.filter((source) => source.kind === "team")
                      .length
                  }
                </small>
              </h3>
              <div className="league-picker">
                {leagueDirectories.map((league) => {
                  const expanded = league.id === selectedLeagueId;
                  const teamCount = followableSources.filter(
                    (source) =>
                      source.kind === "team" && source.sport === league.sport,
                  ).length;
                  return (
                    <button
                      className={`league-card ${expanded ? "expanded" : ""}`}
                      key={league.id}
                      aria-expanded={expanded}
                      onClick={() =>
                        setSelectedLeagueId(expanded ? "" : league.id)
                      }
                    >
                      <TeamMark
                        short={league.short_name}
                        color={league.color}
                      />
                      <span>
                        <b>{league.name}</b>
                        <small>{teamCount} 支球队</small>
                      </span>
                      <CaretRight size={17} />
                    </button>
                  );
                })}
              </div>
              {selectedLeagueId ? (
                <div className="source-grid league-team-grid">
                  {followableSources
                    .filter((source) => {
                      const league = leagueDirectories.find(
                        (candidate) => candidate.id === selectedLeagueId,
                      );
                      return (
                        source.kind === "team" &&
                        source.sport === league?.sport &&
                        (source.name + source.short_name)
                          .toLowerCase()
                          .includes(followSearch.toLowerCase())
                      );
                    })
                    .map((source) => (
                      <FollowSourceCard
                        key={source.id}
                        source={source}
                        checked={followDraft.some(
                          (follow) => follow.source_key === source.id,
                        )}
                        onToggle={() => toggleFollow(source)}
                      />
                    ))}
                </div>
              ) : (
                <p className="league-picker-empty">选择一个联赛后查看球队。</p>
              )}
            </section>
            {!followableSources.length && (
              <Empty
                icon={<Star size={34} />}
                title="还没有可关注的赛事"
                text="数据源接入后，球队和赛事会出现在这里。"
              />
            )}
            <div className="info-note">
              <ShieldCheck size={18} />
              <span>
                同一场比赛命中多个关注时，只会加入日历一次。切换浏览筛选不会改变已保存的关注。
              </span>
            </div>
          </div>
        )}
        {page === "creators" && (
          <CreatorManager
            budget={status?.youtube_budget}
            key={user?.id || "guest"}
            user={user}
            sources={sources}
            epoch={epoch}
            busy={busy}
            run={run}
            requireUser={requireUser}
          />
        )}
        {page === "subscription" && (
          <div className="management-page subscription-page">
            <PublicSubscription sources={sources} flash={flash} />
            <div className="feed-card">
              <div className="feed-art">
                <CalendarBlank size={40} weight="duotone" />
              </div>
              <div className="feed-description">
                <span className="eyebrow">你的个人体育日历</span>
                <h2>Anke Sports</h2>
                <p>
                  {user
                    ? `${user.config.follows.length} 个关注 · ${user.feed.event_count} 场选中比赛`
                    : "登录后，创建属于你的一份体育日历。"}
                </p>
                <span className="feed-status">
                  <i />
                  {!user
                    ? "尚未创建"
                    : user.feed.paused
                      ? "更新已暂停"
                      : user.feed.status === "updating"
                        ? "订阅源更新中"
                        : user.feed.status === "error"
                          ? "更新失败，保留上次内容"
                          : user.feed.status === "pending"
                            ? "订阅源等待发布"
                            : "订阅源已更新"}
                </span>
              </div>
              <button
                className="primary-button"
                disabled={busy}
                onClick={() =>
                  requireUser(() =>
                    run(async () => {
                      const result = await api<{
                        url: string;
                        local_only: boolean;
                      }>("/me/feed/address");
                      await navigator.clipboard.writeText(result.url);
                      flash(
                        result.local_only
                          ? "已复制。本地地址仅供本机测试，手机订阅需要公开 HTTPS 地址。"
                          : "已复制订阅地址，请在日历应用中添加",
                      );
                    }),
                  )
                }
              >
                <Copy size={17} />
                {user ? "复制订阅地址" : "创建个人日历"}
              </button>
            </div>
            {status?.local_preview && (
              <div className="info-note">
                <WarningCircle size={19} />
                <span>
                  当前是本地检查环境。可验证保存、事件更新与 ICS
                  文件；手机持续订阅需在部署后使用公开 HTTPS 地址。
                </span>
              </div>
            )}
            <h3 className="standalone-title">添加到日历</h3>
            <div className="subscription-guide-list">
              <div className="subscription-guide-row">
                <CalendarBlank size={22} />
                <div>
                  <h3>Apple 日历</h3>
                  <p>选择「新建日历订阅」；iCloud 可同步到其他设备。</p>
                </div>
                <a
                  href="https://support.apple.com/guide/calendar/subscribe-to-calendars-icl1022/mac"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Apple 说明 <ArrowUpRight size={15} />
                </a>
              </div>
              <div className="subscription-guide-row">
                <CalendarCheck size={22} />
                <div>
                  <h3>Google 日历</h3>
                  <p>在电脑端「其他日历」中选择「通过网址」。</p>
                </div>
                <a
                  href="https://support.google.com/calendar/answer/37100?hl=zh-Hans"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Google 说明 <ArrowUpRight size={15} />
                </a>
              </div>
            </div>
            <div className="settings-list">
              <Setting
                title="一次性 ICS 文件"
                text="保存当前快照。下载的文件不会持续更新。"
              >
                <button
                  className="secondary-button"
                  disabled={!user || busy || user.feed.status === "updating"}
                  onClick={() =>
                    run(
                      () => download("/me/feed/preview", "anke-sports.ics"),
                      () => flash("已下载当前快照；此文件不会持续更新"),
                    )
                  }
                >
                  <DownloadSimple size={16} />
                  下载 ICS
                </button>
              </Setting>
              <Setting
                title="暂停自动更新"
                text="暂停期间保留最后一份订阅内容。"
              >
                <button
                  className="secondary-button"
                  disabled={!user || busy}
                  onClick={() =>
                    run(() =>
                      mutate("/me/feed/pause", "POST", {
                        confirmed: !user?.feed.paused,
                      }),
                    )
                  }
                >
                  {user?.feed.paused ? (
                    <>
                      <Play size={16} />
                      恢复更新
                    </>
                  ) : (
                    <>
                      <Pause size={16} />
                      暂停更新
                    </>
                  )}
                </button>
              </Setting>
              <Setting
                title="重新生成订阅地址"
                text="旧地址立即失效。比赛身份不变，需要在日历中重新添加订阅。"
              >
                <button
                  className="text-button"
                  disabled={!user}
                  onClick={() => setConfirm("rotate")}
                >
                  <ArrowClockwise size={16} />
                  重新生成
                </button>
              </Setting>
            </div>
            <div className="info-note">
              <Clock size={18} />
              <span>
                订阅源更新后，系统日历会在下次刷新时显示。Anke Sports 无法控制
                Apple 或 Google 的刷新时间。
              </span>
            </div>
          </div>
        )}
        {page === "settings" && (
          <div className="management-page settings-page">
            <h2>日历偏好</h2>
            <div className="settings-list">
              <Setting title="日历时区" text="影响日期与开赛时间的显示。">
                <select
                  aria-label="保存的日历时区"
                  value={preferences.timezone}
                  onChange={(e) =>
                    setPreferences({ ...preferences, timezone: e.target.value })
                  }
                >
                  {[
                    "Asia/Shanghai",
                    "America/New_York",
                    "America/Los_Angeles",
                    "Europe/London",
                    "Europe/Paris",
                    "Asia/Tokyo",
                    "UTC",
                  ].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Setting>
              <Setting
                title="观看地区"
                text="用于筛选已标明地区限制的观看入口。"
              >
                <select
                  aria-label="观看地区"
                  value={preferences.watch_region || ""}
                  onChange={(e) =>
                    setPreferences({
                      ...preferences,
                      watch_region: e.target.value || null,
                    })
                  }
                >
                  <option value="">暂不设置</option>
                  <option value="CN">中国大陆</option>
                  <option value="US">美国</option>
                  <option value="GB">英国</option>
                  <option value="JP">日本</option>
                  <option value="HK">中国香港</option>
                </select>
              </Setting>
              <Setting
                title="防剧透"
                text="用通用标签替代日历描述里的复盘标题。"
              >
                <Toggle
                  label="防剧透"
                  checked={preferences.spoiler_free}
                  onChange={(x) =>
                    setPreferences({ ...preferences, spoiler_free: x })
                  }
                />
              </Setting>
              <Setting
                title="不占用忙碌时间"
                text="比赛显示在日历中，不阻挡其他安排。"
              >
                <Toggle
                  label="不占用忙碌时间"
                  checked={preferences.transparent}
                  onChange={(x) =>
                    setPreferences({ ...preferences, transparent: x })
                  }
                />
              </Setting>
            </div>
            <button
              className="primary-button"
              disabled={busy}
              onClick={() =>
                requireUser(() =>
                  run(
                    () =>
                      mutate("/me/preferences", "PATCH", {
                        expected_revision: user!.revision,
                        preferences,
                      }),
                    savedMessage,
                  ),
                )
              }
            >
              保存偏好
            </button>
            <h2 className="section-gap">个人配置</h2>
            <div className="settings-list">
              <Setting
                title="导出配置"
                text="包含关注、创作者和个人规则，不包含账号凭据或私人订阅地址。"
              >
                <button
                  className="secondary-button"
                  disabled={!user}
                  onClick={() =>
                    run(() =>
                      download("/me/config/export", "anke-sports-config.json"),
                    )
                  }
                >
                  <DownloadSimple size={16} />
                  导出 JSON
                </button>
              </Setting>
            </div>
            <details className="import-panel">
              <summary>导入已有配置</summary>
              <textarea
                aria-label="配置 JSON"
                placeholder="粘贴 Anke Sports 配置 JSON"
                value={importText}
                onChange={(e) => {
                  setImportText(e.target.value);
                  setImportPreview(null);
                }}
              />
              <div className="import-actions">
                <select
                  aria-label="导入方式"
                  value={importMode}
                  onChange={(e) => {
                    setImportMode(e.target.value);
                    setImportPreview(null);
                  }}
                >
                  <option value="merge">合并现有配置</option>
                  <option value="replace">替换现有配置</option>
                </select>
                <button
                  className="secondary-button"
                  disabled={!user || !importText || busy}
                  onClick={() =>
                    run(async () =>
                      setImportPreview(
                        await api<ImportPreview>("/me/config/import", {
                          method: "POST",
                          body: JSON.stringify({
                            config: JSON.parse(importText),
                            mode: importMode,
                            dry_run: true,
                            expected_revision: user!.revision,
                          }),
                        }),
                      ),
                    )
                  }
                >
                  预览差异
                </button>
              </div>
              {importPreview && (
                <div className="import-result">
                  <p>
                    新增 {importPreview.added} 项，移除 {importPreview.removed}{" "}
                    项，无法解析 {importPreview.unresolved.length} 项。
                  </p>
                  {importPreview.unresolved.length > 0 && (
                    <p>{importPreview.unresolved.join("、")}</p>
                  )}
                  <button
                    className="primary-button"
                    disabled={busy || !!importPreview.unresolved.length}
                    onClick={() =>
                      run(
                        () =>
                          mutate("/me/config/import", "POST", {
                            config: JSON.parse(importText),
                            mode: importMode,
                            dry_run: false,
                            expected_revision: importPreview.revision,
                            confirmation: importPreview.confirmation,
                          }),
                        () => {
                          setImportPreview(null);
                          setImportText("");
                          savedMessage();
                        },
                      )
                    }
                  >
                    确认导入
                  </button>
                </div>
              )}
            </details>
            <h2 className="section-gap">数据源与集成</h2>
            <div className="settings-list">
              {status?.providers
                .filter((p) => p.id !== "youtube")
                .map((p) => (
                  <Setting
                    key={p.id}
                    title={
                      p.id === "jolpica"
                        ? "F1 · Jolpica"
                        : p.id === "balldontlie"
                          ? "NBA · BALLDONTLIE"
                          : "足球 · football-data.org"
                    }
                    text={
                      (p.error
                        ? `上次更新未完成：${p.error}`
                        : p.last_success
                          ? `上次获取：${new Date(p.last_success).toLocaleString("zh-CN")}`
                          : "尚未获取真实赛程") +
                      (p.activity === "queued" || p.activity === "running"
                        ? " · 后台正在处理"
                        : p.activity === "waiting"
                          ? " · 已排队，等待重试"
                          : "") +
                      (p.next_attempt_at &&
                      new Date(p.next_attempt_at).getTime() > Date.now()
                        ? ` · 最早重试：${new Date(p.next_attempt_at).toLocaleString("zh-CN")}`
                        : "")
                    }
                  >
                    {status.local_preview && (
                      <button
                        className="secondary-button"
                        disabled={!user || busy}
                        onClick={() =>
                          run(
                            () =>
                              mutate(`/local/providers/${p.id}/sync`, "POST"),
                            () =>
                              flash("已加入后台任务；完成后可切换真实赛程查看"),
                          )
                        }
                      >
                        <ArrowClockwise size={15} />
                        获取赛程
                      </button>
                    )}
                  </Setting>
                ))}
            </div>
            <ConnectionManager key={user?.id || "guest"} userId={user?.id} />
            <div className="settings-list danger-zone">
              <Setting
                title="删除账号与个人数据"
                text="删除关注、私人链接与应用授权，停止私人订阅。系统日历中的缓存需要在那里删除。"
              >
                <button
                  className="danger-button"
                  disabled={!user || status?.local_preview}
                  onClick={() => setConfirm("delete")}
                >
                  删除账号
                </button>
              </Setting>
            </div>
          </div>
        )}
      </main>
      {toast && (
        <div
          className={`toast${toastClosing ? " is-closing" : ""}`}
          role="status"
        >
          <Check size={18} />
          {toast}
        </div>
      )}
      {followReview && (
        <Modal
          title="关注变更预览"
          wide
          onClose={() => {
            if (!followSaving) setFollowReview(null);
          }}
        >
          {(close) => (
            <FollowPreview
              {...followReview}
              timezone={timezone}
              onSaving={setFollowSaving}
              onClose={() => {
                if (!followSaving) close();
              }}
              onSaved={() => {
                refresh();
                savedMessage();
                close();
              }}
            />
          )}
        </Modal>
      )}
      {login && (
        <Modal title="登录 Anke Sports" onClose={() => setLogin(false)}>
          {(close) => (
            <>
              <button
                className="dialog-close"
                aria-label="关闭登录"
                onClick={close}
              >
                <X size={20} />
              </button>
              <div className="login-symbol">
                <Basketball size={38} weight="duotone" />
              </div>
              <h2>保存关注与订阅</h2>
              <p>登录后创建持续更新的个人体育日历。</p>
              {status?.firebase_configured && (
                <GoogleSignIn
                  disabled={busy}
                  onSignedIn={() => {
                    setError("");
                    refresh();
                    close();
                  }}
                />
              )}
              {status?.local_preview && (
                <>
                  <button
                    className="primary-button full-width"
                    disabled={busy}
                    onClick={() =>
                      run(
                        () => mutate("/auth/local", "POST"),
                        () => {
                          close();
                          flash("已进入本地体验，操作保存在本机");
                        },
                      )
                    }
                  >
                    进入本地体验 <ArrowUpRight size={17} />
                  </button>
                  <small className="modal-note">
                    本机独立体验账号。正式账号由 Firebase 提供。
                  </small>
                </>
              )}
              {!status?.local_preview && !status?.firebase_configured && (
                <p>登录服务尚未配置。你仍可以浏览公开赛程。</p>
              )}
            </>
          )}
        </Modal>
      )}
      {accountOpen && user && (
        <Modal title="账号" onClose={() => setAccountOpen(false)}>
          {(close) => (
            <>
              <button
                className="dialog-close"
                aria-label="关闭账号面板"
                onClick={close}
              >
                <X size={20} />
              </button>
              <span className="eyebrow">当前账号</span>
              <h2>{user.display_name || "Anke Sports 用户"}</h2>
              <p>退出前会先保留你的关注、订阅地址与个人设置。</p>
              <div className="modal-actions">
                <button className="secondary-button" onClick={close}>
                  继续使用
                </button>
                <button
                  className="danger-button"
                  disabled={busy}
                  onClick={() =>
                    run(logout, () => {
                      close();
                      flash("已退出登录");
                    })
                  }
                >
                  <SignOut size={16} />
                  退出登录
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
      {selected && (
        <Modal title={selected.title} onClose={closeEvent} drawer>
          {(close) => (
            <EventDrawer
              event={selected}
              sources={sources}
              timezone={timezone}
              spoilerFree={preferences.spoiler_free}
              onClose={close}
              onAdd={() => requireUser(() => setAdding(true))}
              onToggle={() =>
                requireUser(() =>
                  run(async () => {
                    await mutate(`/events/${selected.id}/selection`, "PUT", {
                      state: selected.included ? "exclude" : "include",
                      expected_revision: user!.revision,
                    });
                    await reloadEvent();
                  }, savedMessage),
                )
              }
              onPin={(id) =>
                requireUser(() =>
                  run(
                    async () => {
                      await mutate(`/me/links/${id}/pin`, "POST");
                      await reloadEvent();
                    },
                    () => flash("链接已固定，停止关注创作者后仍会保留"),
                  ),
                )
              }
              onBlock={(id) =>
                requireUser(() =>
                  run(
                    async () => {
                      await mutate(`/me/links/${id}/block`, "POST");
                      await reloadEvent();
                    },
                    () => flash("已移除此链接，自动更新不会将它加回"),
                  ),
                )
              }
              busy={busy}
            />
          )}
        </Modal>
      )}
      {adding && selected && (
        <Modal title="附加原始链接" onClose={() => setAdding(false)}>
          {(close) => (
            <AddLinkForm
              event={selected}
              error={error}
              busy={busy}
              close={close}
              submit={(values) =>
                run(
                  async () => {
                    await mutate(
                      `/events/${selected.id}/links`,
                      "POST",
                      values,
                    );
                    await reloadEvent();
                  },
                  () => {
                    close();
                    savedMessage();
                  },
                )
              }
            />
          )}
        </Modal>
      )}
      {confirm && (
        <Modal
          title={confirm === "rotate" ? "重新生成订阅地址" : "删除账号"}
          onClose={() => setConfirm(null)}
        >
          {(close) => (
            <>
              <h2>
                {confirm === "rotate"
                  ? "替换现有订阅地址？"
                  : "删除账号与个人数据？"}
              </h2>
              <p>
                {confirm === "rotate"
                  ? "旧地址将立即失效。请在系统日历中移除旧订阅，再添加新地址；比赛 UID 保持不变。"
                  : "此操作会删除你的关注、私人链接与应用授权，停止私人订阅，并清理登录账号。已缓存内容需在系统日历中删除。"}
              </p>
              <div className="modal-actions">
                <button className="secondary-button" onClick={close}>
                  取消
                </button>
                <button
                  className="danger-button"
                  disabled={busy}
                  onClick={() =>
                    run(
                      async () => {
                        if (confirm === "rotate") {
                          await mutate("/me/feed/rotate", "POST", {
                            confirmed: true,
                          });
                        } else {
                          const result = await deleteAccount();
                          try {
                            sessionStorage.setItem(
                              "anke-account-deleted",
                              JSON.stringify(result),
                            );
                          } catch {
                            /* Continue to discard all mounted personal UI state. */
                          }
                          window.location.replace("/calendar");
                        }
                      },
                      () => {
                        close();
                        flash("操作已完成");
                      },
                    )
                  }
                >
                  确认{confirm === "rotate" ? "重新生成" : "删除"}
                </button>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

function Empty({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
function Setting({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <div className="setting-row">
      <div>
        <h3>{title}</h3>
        <p>{text}</p>
      </div>
      {children}
    </div>
  );
}
function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      className={`toggle ${checked ? "on" : ""}`}
      role="switch"
      aria-label={label}
      aria-checked={checked}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

function EventDrawer({
  event,
  sources,
  timezone,
  spoilerFree,
  onClose,
  onAdd,
  onToggle,
  onBlock,
  onPin,
  busy,
}: {
  event: SportEvent;
  sources: Source[];
  timezone: string;
  spoilerFree: boolean;
  onClose: () => void;
  onAdd: () => void;
  onToggle: () => void;
  onBlock: (id: string) => void;
  onPin: (id: string) => void;
  busy: boolean;
}) {
  const eventDate = event.starts_at
    ? new Intl.DateTimeFormat("zh-CN", {
        timeZone: timezone,
        month: "long",
        day: "numeric",
        weekday: "long",
      }).format(new Date(event.starts_at))
    : event.local_date || "日期待定";
  return (
    <>
      <div className="drawer-top">
        <span>
          {leagueOf(event, sources)} {event.demo && <small>演示比赛</small>}
        </span>
        <button
          className="icon-button"
          aria-label="关闭比赛详情"
          onClick={onClose}
        >
          <X size={21} />
        </button>
      </div>
      <div className={`match-hero ${event.sport}`}>
        {event.participants.length === 2 ? (
          <div className="match-teams">
            {event.participants.map((p, i) => {
              const source = sources.find((item) => item.id === p.id);
              return (
                <div className="match-team" key={p.id}>
                  <TeamMark
                    short={p.short_name}
                    color={p.color}
                    logoUrl={source?.logo_url}
                  />
                  <b>{p.name}</b>
                  <small>{i === 0 ? "客队" : "主队"}</small>
                </div>
              );
            })}
            <span className="versus">vs</span>
          </div>
        ) : (
          <div className="match-race">
            <FlagCheckered size={42} weight="duotone" />
            <h2>{event.title}</h2>
          </div>
        )}
        <div className="match-start">
          <strong>{timeOf(event, timezone)}</strong>
          <span>{eventDate}</span>
          {event.status !== "scheduled" && (
            <small>
              {(
                {
                  cancelled: "已取消",
                  postponed: "已延期",
                  finished: "已结束",
                } as Record<string, string>
              )[event.status] || event.status}
            </small>
          )}
        </div>
      </div>
      <div className="match-facts">
        <span>
          <GlobeHemisphereWest size={15} />
          {timezone}
        </span>
        <span>
          <MapPin size={15} />
          {event.venue || "场馆尚未公布"}
        </span>
        <span>
          <Clock size={15} />
          预计 {event.duration} 分钟
        </span>
      </div>
      <button
        className={`drawer-follow ${event.included ? "included" : ""}`}
        disabled={busy}
        onClick={onToggle}
      >
        {event.included ? (
          <>
            <CalendarCheck size={18} />
            已加入个人日历
          </>
        ) : (
          <>
            <Plus size={18} />
            加入个人日历
          </>
        )}
      </button>
      <div className="drawer-links">
        {[
          ["live", "观看直播"],
          ["preview", "赛前前瞻"],
          ["recap", "赛后复盘"],
        ].map(([kind, title]) => {
          const links = event.links.filter(
            (l) =>
              l.kind === kind || (kind === "live" && l.kind === "watch_along"),
          );
          const Icon = kind === "live" ? Broadcast : YoutubeLogo;
          return (
            <section key={kind}>
              <h3>
                <Icon size={19} />
                {title}
                <span>{links.length || ""}</span>
              </h3>
              {links.length ? (
                links.map((link) => (
                  <div className="content-link" key={link.id}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <strong>
                        {kind === "recap" && spoilerFree
                          ? `${link.creator || link.platform} · 赛后复盘`
                          : link.title}
                        <ArrowUpRight size={15} />
                      </strong>
                      <small>
                        {link.creator || link.platform} ·{" "}
                        {link.origin === "manual"
                          ? "手动添加"
                          : link.origin === "confirmed"
                            ? "已人工确认"
                            : link.origin === "official"
                              ? "官方审核"
                              : "自动关联"}
                      </small>
                      {kind === "live" && (
                        <small>
                          {link.broadcast
                            ? `${link.broadcast.content_label} · ${link.broadcast.access_label} · ${link.broadcast.region_label}`
                            : link.kind === "watch_along"
                              ? "同步解说，无比赛画面 · 观看条件与地区未验证"
                              : "手动添加，观看条件与地区未验证"}
                        </small>
                      )}
                    </a>
                    {link.broadcast && (
                      <details className="broadcast-evidence">
                        <summary>来源与核验记录</summary>
                        <p>
                          来源核验：
                          {new Date(
                            link.broadcast.reviewed_at,
                          ).toLocaleDateString("zh-CN")}{" "}
                          · 到期复查：
                          {new Date(
                            link.broadcast.valid_until,
                          ).toLocaleDateString("zh-CN")}
                        </p>
                        <a
                          href={link.broadcast.evidence_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          查看官方来源 ↗
                        </a>
                        <p>
                          网页检查：
                          {link.broadcast.network_status === "reachable"
                            ? "网页可达，不代表可播放"
                            : link.broadcast.network_status === "not_checked"
                              ? "尚未检查"
                              : "存在访问限制或待复查"}
                        </p>
                        {link.broadcast.device_tests.length ? (
                          link.broadcast.device_tests.map((test, i) => (
                            <p key={i}>
                              {String(test.os_version)} ·{" "}
                              {String(test.calendar_client)} ·{" "}
                              {String(test.platform_app)} ·{" "}
                              {String(test.region)}
                              <br />
                              {new Date(String(test.checked_at)).toLocaleString(
                                "zh-CN",
                              )}
                              ： 内容
                              {test.exact_content === "passed"
                                ? "通过"
                                : test.exact_content === "failed"
                                  ? "未通过"
                                  : "未测试"}{" "}
                              / App
                              {test.app_content === "passed"
                                ? "通过"
                                : test.app_content === "failed"
                                  ? "未通过"
                                  : "未测试"}{" "}
                              / 播放
                              {test.playback === "passed"
                                ? "通过"
                                : test.playback === "failed"
                                  ? "未通过"
                                  : "未测试"}
                              <br />
                              条件：{String(test.conditions)}。仅代表此次观察。
                            </p>
                          ))
                        ) : (
                          <p>
                            尚无本链接的实际设备观察，不承诺App内具体内容直达。
                          </p>
                        )}
                      </details>
                    )}
                    <button
                      className="icon-button"
                      aria-label={`${link.pinned ? "已固定" : "固定链接"} ${link.title}`}
                      title={link.pinned ? "已固定" : "固定链接"}
                      disabled={busy || link.pinned}
                      onClick={() => onPin(link.id)}
                    >
                      <PushPin
                        size={13}
                        weight={link.pinned ? "fill" : "regular"}
                      />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`移除链接 ${link.title}`}
                      disabled={busy}
                      onClick={() => onBlock(link.id)}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="link-empty">
                  <span>
                    {kind === "live"
                      ? "暂无已确认的本场直播入口"
                      : kind === "preview"
                        ? "暂无明确对应本场的前瞻视频"
                        : "暂无对应本场的复盘链接"}
                  </span>
                  {kind === "preview" && (
                    <Link href="/creators" onClick={onClose}>
                      管理创作者 <ArrowUpRight size={12} />
                    </Link>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
      <button className="add-link-button" onClick={onAdd}>
        <LinkSimple size={17} />
        手动附加链接
        <Plus size={15} />
      </button>
      <details className="description-preview">
        <summary>
          日历描述预览 <CaretRight size={14} />
        </summary>
        {!event.description_in_feed && (
          <p>本场尚未加入个人日历，以下是内容预览。</p>
        )}
        <pre>{event.description}</pre>
      </details>
      <div className="drawer-source">
        <ShieldCheck size={15} />
        <div>
          来源：{event.provider}
          <small>
            赛程更新于 {new Date(event.updated_at).toLocaleString("zh-CN")}
          </small>
          {event.demo && <small>合成比赛，用于界面与订阅测试</small>}
        </div>
      </div>
    </>
  );
}

function AddLinkForm({
  event,
  error,
  busy,
  close,
  submit,
}: {
  event: SportEvent;
  error: string;
  busy: boolean;
  close: () => void;
  submit: (data: {
    url: string;
    title: string;
    kind: string;
  }) => Promise<boolean>;
}) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("preview");
  const [localError, setLocalError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setLocalError("");
        const ok = await submit({ url, title, kind });
        if (!ok) setLocalError("链接未保存，请检查地址与平台支持。");
      }}
    >
      <button
        type="button"
        className="dialog-close"
        aria-label="关闭添加链接"
        onClick={close}
      >
        <X size={20} />
      </button>
      <h2>把原链接放在这场比赛里。</h2>
      <p>{event.title}</p>
      <label className="form-label">
        内容链接
        <input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=…"
          autoFocus
        />
      </label>
      <label className="form-label">
        类型
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="preview">赛前前瞻</option>
          <option value="recap">赛后复盘</option>
          <option value="live">直播入口</option>
          <option value="watch_along">同步解说，无比赛画面</option>
        </select>
      </label>
      <label className="form-label">
        标题（可选）
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="保留原视频标题"
          maxLength={300}
        />
      </label>
      <small className="modal-note">
        仅影响你的个人日历。手动链接不会自动获得官方认证。
      </small>
      {localError && (
        <p role="alert" className="inline-error">
          {error || localError}
        </p>
      )}
      <button className="primary-button full-width" disabled={busy}>
        保存链接 <Plus size={16} />
      </button>
    </form>
  );
}
