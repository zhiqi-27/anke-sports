"use client";
import Link from "next/link";
import { BrandMark } from "./brand-mark";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarBlank,
  Star,
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
  ArrowCounterClockwise,
} from "@phosphor-icons/react";
import { api, deleteAccount, download, logout } from "@/lib/api";
import type {
  AuthProfile,
  Config,
  Follow,
  ImportPreview,
  Preferences,
  Source,
  SportEvent,
} from "@/lib/types";
import { BroadcastManager } from "./broadcast-manager";
import { BroadcastPreferences } from "./broadcast-preferences";
import { FollowPreview } from "./follow-preview";
import { ConnectionManager } from "./connections";
import { GoogleSignIn } from "./google-sign-in";
import { useAnke } from "@/hooks/use-anke";
import { TeamMark, leagueOf, timeOf } from "./calendar-view";
import { SelectMenu } from "./select-menu";

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
  { id: "subscription", label: "日历订阅", icon: Broadcast },
  { id: "settings", label: "设置", icon: GearSix },
];
const timezoneOptions = [
  "Asia/Shanghai",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "UTC",
].map((value) => ({ value, label: value }));
const pageInfo: Record<string, [string, string]> = {
  calendar: ["比赛日历", ""],
  following: ["我的关注", ""],
  subscription: ["日历订阅", "复制地址，在 Apple 或 Google 日历中添加。"],
  settings: ["设置", ""],
  maintenance: ["直播入口维护", "核对来源、场次与兼容性证据。"],
};

function recordSignature(value: Record<string, string>) {
  return JSON.stringify(
    Object.entries(value).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function preferenceChangeCount(current: Preferences, saved?: Preferences) {
  if (!saved) return 0;
  return [
    current.timezone !== saved.timezone,
    current.spoiler_free !== saved.spoiler_free,
    current.transparent !== saved.transparent,
    current.watch_region !== saved.watch_region,
    recordSignature(current.broadcast_platforms) !==
      recordSignature(saved.broadcast_platforms),
  ].filter(Boolean).length;
}

function canFollowDirectly(source: Source) {
  return source.kind === "team";
}

const competitionLogoUrls: Record<string, string> = {
  "jolpica:f1":
    "https://www.formula1.com/etc/designs/fom-website/images/f1_logo.svg",
  "balldontlie:nba": "https://cdn.simpleicons.org/nba/F3B56A",
  "football-data:PL": "https://cdn.simpleicons.org/premierleague/B3A0E2",
};

function profileInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "A";
  if (words.length > 1) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return Array.from(words[0]).slice(0, 2).join("").toUpperCase();
}

function prepareAvatar(file: File) {
  if (!file.type.startsWith("image/")) {
    return Promise.reject(new Error("请选择图片文件"));
  }
  if (file.size > 5 * 1024 * 1024) {
    return Promise.reject(new Error("图片不能超过 5MB"));
  }
  return new Promise<string>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(
        1,
        256 / Math.max(image.naturalWidth, image.naturalHeight),
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("头像处理失败，请重试"));
        return;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("头像处理失败，请重试"));
    };
    image.src = objectUrl;
  });
}

function ProfileAvatar({
  profile,
  name,
  large = false,
}: {
  profile: AuthProfile | null;
  name: string;
  large?: boolean;
}) {
  return (
    <span className={`avatar${large ? " avatar-large" : ""}`}>
      <span>{profileInitials(name)}</span>
      {profile?.photoURL && (
        <img
          src={profile.photoURL}
          alt=""
          aria-hidden="true"
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />
      )}
    </span>
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
    profile,
    accountReady,
    sources,
    dataset,
    status,
    epoch,
    busy,
    error,
    setError,
    run,
    saveProfile,
    refresh,
  } = state;
  const [timezone, setTimezone] = useState("Asia/Shanghai");
  const [selected, setSelected] = useState<SportEvent | null>(null);
  const [teamSourceId, setTeamSourceId] = useState("");
  const [login, setLogin] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [profileDraft, setProfileDraft] = useState({
    displayName: "",
  });
  const [avatarDraft, setAvatarDraft] = useState("");
  const [avatarPreparing, setAvatarPreparing] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
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
          sources.some(
            (candidate) =>
              candidate.kind === "team" &&
              candidate.sport === source.sport,
          ),
      ),
    [sources],
  );
  const selectedLeague = leagueDirectories.find(
    (league) => league.id === selectedLeagueId,
  );
  const selectedTeamNoun = selectedLeague?.sport === "racing" ? "车队" : "球队";
  const selectedLeagueTeams = useMemo(() => {
    if (!selectedLeague) return [];
    const query = followSearch.trim().toLowerCase();
    return followableSources.filter(
      (source) =>
        source.kind === "team" &&
        source.sport === selectedLeague.sport &&
        (source.name + source.short_name).toLowerCase().includes(query),
    );
  }, [followSearch, followableSources, selectedLeague]);
  const [preferences, setPreferences] = useState<Preferences>({
    timezone: "Asia/Shanghai",
    locale: "zh-CN",
    watch_region: null,
    spoiler_free: true,
    transparent: true,
    broadcast_platforms: {},
  });
  const [importText, setImportText] = useState("");
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(
    null,
  );
  const [importMode, setImportMode] = useState("merge");
  const [importOpen, setImportOpen] = useState(false);
  const [importError, setImportError] = useState("");
  const [confirm, setConfirm] = useState<"rotate" | "delete" | null>(null);
  const [accountNotice, setAccountNotice] = useState("");
  const previousAccount = useRef<string | null>(null);
  const accountName = profile?.displayName || user?.display_name || "Anke Sports 用户";
  const profileAvailable = Boolean(
    profile || (status?.firebase_configured && !status.local_preview),
  );
  useEffect(() => {
    const syncTeamSource = () => {
      setTeamSourceId(
        page === "calendar"
          ? new URL(window.location.href).searchParams.get("team") || ""
          : "",
      );
    };
    syncTeamSource();
    window.addEventListener("popstate", syncTeamSource);
    return () => window.removeEventListener("popstate", syncTeamSource);
  }, [page]);
  const teamCalendarSource = useMemo(
    () =>
      sources.find(
        (source) => source.id === teamSourceId && source.kind === "team",
      ),
    [sources, teamSourceId],
  );
  useEffect(() => {
    if (!accountOpen || !user) return;
    setProfileDraft({
      displayName: profile?.displayName || user.display_name || "",
    });
    setAvatarDraft("");
  }, [accountOpen, profile?.displayName, profile?.photoURL, user?.display_name]);
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
      setImportOpen(false);
      setImportError("");
      setFollowSearch("");
      setSelectedLeagueId("");
      setFollowSaving(false);
      setAdding(false);
      setProfileDraft({ displayName: "" });
      setAvatarDraft("");
      setAvatarPreparing(false);
      setProfileSaving(false);
      setConfirm(null);
      setTimezone("Asia/Shanghai");
      setPreferences({
        timezone: "Asia/Shanghai",
        locale: "zh-CN",
        watch_region: null,
        spoiler_free: true,
        transparent: true,
        broadcast_platforms: {},
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
      const pendingFollows = pendingGuestFollows.current;
      const nextFollows = pendingFollows
        ? Array.from(
            new Map(
              [...user.config.follows, ...pendingFollows].map((follow) => [
                follow.source_key,
                follow,
              ]),
            ).values(),
          )
        : user.config.follows;
      setFollowDraft(nextFollows);
      if (pendingFollows) {
        setFollowReview({ follows: nextFollows, revision: user.revision });
      }
      pendingGuestFollows.current = null;
    }
  }, [user?.revision, user?.id]); // Preferences refresh only after authoritative configuration changes.
  const preferenceChanges = preferenceChangeCount(
    preferences,
    user?.config.preferences,
  );
  const preferencesDirty = preferenceChanges > 0;
  useEffect(() => {
    if (!preferencesDirty) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const confirmInternalNavigation = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.target === "_blank" || link.hasAttribute("download"))
        return;
      const destination = new URL(link.href, window.location.href);
      if (destination.href === window.location.href) return;
      if (!window.confirm("你有尚未保存的设置。确定要离开吗？")) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warnBeforeLeaving);
    document.addEventListener("click", confirmInternalNavigation, true);
    return () => {
      window.removeEventListener("beforeunload", warnBeforeLeaving);
      document.removeEventListener("click", confirmInternalNavigation, true);
    };
  }, [preferencesDirty]);
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
            { type: "team", source_key: source.id },
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
  const mutate = (
    path: string,
    method: string,
    data?: unknown,
    headers?: HeadersInit,
  ) =>
    api(path, {
      method,
      headers,
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  const reloadEvent = async () => {
    if (selected) setSelected(await api<SportEvent>(`/events/${selected.id}`));
    refresh();
  };
  const changeManualCalendar = (
    method: "POST" | "DELETE",
    message: string,
  ) => {
    requireUser(() => {
      const eventId = selected?.id;
      if (!eventId) return;
      const expectedRevision = user!.revision;
      void run(
        async () => {
          await mutate(
            `/me/calendar/events/${eventId}`,
            method,
            { expected_revision: expectedRevision },
            { "Idempotency-Key": crypto.randomUUID() },
          );
          setSelected(await api<SportEvent>(`/events/${eventId}`));
        },
        () => flash(message),
      );
    });
  };
  const savedMessage = () => flash("已保存，订阅源更新中");
  const chooseAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setAvatarPreparing(true);
    setError("");
    try {
      setAvatarDraft(await prepareAvatar(file));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "头像处理失败，请重试");
    } finally {
      setAvatarPreparing(false);
    }
  };
  const saveProfileSettings = async () => {
    const displayName = profileDraft.displayName.trim();
    if (!displayName || displayName.length > 80) {
      setError("请输入 1 至 80 个字符的显示名称");
      return;
    }
    setProfileSaving(true);
    setError("");
    try {
      await saveProfile({
        displayName,
        photoURL: avatarDraft || profile?.photoURL || null,
      });
      setAvatarDraft("");
      flash("个人资料已保存");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "个人资料保存失败，请重试");
    } finally {
      setProfileSaving(false);
    }
  };
  if (!accountReady) {
    return (
      <div className="boot-screen" role="status" aria-live="polite">
        <span className="brand-icon">
          <BrandMark size={32} />
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
            <BrandMark size={32} />
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
            </Link>
          ))}
        </nav>
        <div className="sidebar-follows">
          <div className="sidebar-heading">
            <span>我的关注</span>
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
                <a
                  key={s.id}
                  className="mini-follow"
                  href={`/calendar?team=${encodeURIComponent(s.id)}`}
                >
                  <TeamMark
                    short={s.short_name}
                    color={s.color}
                    logoUrl={s.logo_url}
                    small
                  />
                  <span>{s.name}</span>
                </a>
              ))
          ) : (
            <div className="sidebar-empty">
              <span>尚未关注球队或赛事。</span>
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
            {user ? (
              <ProfileAvatar profile={profile} name={accountName} />
            ) : (
              <span className="avatar"><SignIn size={20} /></span>
            )}
            <span>
              <b>{user ? accountName : "登录 Anke Sports"}</b>
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
            {page !== "settings" && (
              <>
                <GlobeHemisphereWest size={16} />
                <SelectMenu
                  ariaLabel="临时显示时区（不保存）"
                  title="仅改变当前页面显示；默认时区请在设置中保存"
                  value={timezone}
                  placeholder="选择时区"
                  className="select-menu--quiet topbar-timezone-menu"
                  groups={[{ options: timezoneOptions }]}
                  onChange={setTimezone}
                />
              </>
            )}
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
            <h1>
              {page === "calendar" && teamCalendarSource
                ? `${teamCalendarSource.name} 日历`
                : pageInfo[page][0]}
            </h1>
            {pageInfo[page][1] && <p>{pageInfo[page][1]}</p>}
          </div>
          {status?.local_preview && (
            <div className="dataset-control">
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
            </div>
          )}
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
            teamSourceId={teamSourceId}
            teamSource={teamCalendarSource}
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
                <h2>选择球队或车队</h2>
              </div>
              <button
                className="primary-button"
                disabled={
                  busy ||
                  (!user && !followDraft.length) ||
                  (!!user && !followChanged)
                }
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
                {!user ? "登录并保存" : followChanged ? "预览变更" : "已保存"}
              </button>
            </div>
            <section className="source-section">
              <h3>
                按赛事选择球队或车队
                <small>{leagueDirectories.length}</small>
              </h3>
              <div className="league-picker">
                {leagueDirectories.map((league) => {
                  const expanded = league.id === selectedLeagueId;
                  const teamCount = followableSources.filter(
                    (source) =>
                      source.kind === "team" &&
                      source.sport === league.sport,
                  ).length;
                  const selectedCount = followDraft.filter((follow) =>
                    followableSources.some(
                      (source) =>
                        source.id === follow.source_key &&
                        source.kind === "team" &&
                        source.sport === league.sport,
                    ),
                  ).length;
                  return (
                    <button
                      className={`league-card ${expanded ? "expanded" : ""}`}
                      key={league.id}
                      aria-expanded={expanded}
                      aria-controls={`league-teams-${league.id}`}
                      onClick={() => {
                        setFollowSearch("");
                        setSelectedLeagueId(expanded ? "" : league.id);
                      }}
                    >
                      <TeamMark
                        short={league.short_name}
                        color={league.color}
                        logoUrl={
                          league.logo_url || competitionLogoUrls[league.id]
                        }
                      />
                      <span>
                        <b>{league.name}</b>
                        <small>
                          {teamCount} 支{league.sport === "racing" ? "车队" : "球队"}
                          {selectedCount ? ` · 已选 ${selectedCount}` : ""}
                        </small>
                      </span>
                      <CaretRight size={17} />
                    </button>
                  );
                })}
              </div>
              {selectedLeague ? (
                <div
                  className="league-team-panel"
                  id={`league-teams-${selectedLeague.id}`}
                  aria-live="polite"
                >
                  <div className="league-team-toolbar">
                    <strong>
                      {selectedLeague.short_name} {selectedTeamNoun}
                    </strong>
                    <label className="search-field">
                      <span className="sr-only">
                        搜索{selectedLeague.short_name}{selectedTeamNoun}
                      </span>
                      <SlidersHorizontal size={18} />
                      <input
                        value={followSearch}
                        onChange={(event) =>
                          setFollowSearch(event.target.value)
                        }
                        placeholder={`搜索${selectedLeague.short_name}${selectedTeamNoun}`}
                      />
                    </label>
                  </div>
                  <div className="source-grid">
                    {selectedLeagueTeams.map((source) => (
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
                  {!selectedLeagueTeams.length && (
                    <p className="league-picker-empty">
                      没有找到对应{selectedTeamNoun}。
                    </p>
                  )}
                </div>
              ) : (
                <p className="league-picker-empty">
                  选择一个赛事或联赛后查看球队或车队。
                </p>
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
        {page === "subscription" && (
          <div className="management-page subscription-page">
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
            <p className="settings-intro">
              偏好修改后统一保存；导出、导入和连接管理会独立执行。
            </p>

            {preferencesDirty && (
              <div
                className="settings-save-bar"
                role="region"
                aria-label="未保存的设置"
              >
                <div>
                  <b>{preferenceChanges} 项设置尚未保存</b>
                  <span>保存后会更新个人日历订阅。</span>
                </div>
                <div className="settings-save-actions">
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => {
                      setPreferences(user!.config.preferences);
                    }}
                  >
                    <ArrowCounterClockwise size={16} />
                    取消修改
                  </button>
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
                    <Check size={16} />
                    保存 {preferenceChanges} 项
                  </button>
                </div>
              </div>
            )}

            <section
              className="settings-section"
              aria-labelledby="calendar-settings-title"
            >
              <div className="settings-section-heading">
                <span className="eyebrow">日历显示</span>
                <h2 id="calendar-settings-title">日期与事件呈现</h2>
                <p>控制个人日历中的时间、标题和忙碌状态。</p>
              </div>
              <div className="settings-list">
                <Setting
                  title="日历时区"
                  text="保存到账号，并用于日期与开赛时间。"
                >
                  <SelectMenu
                    ariaLabel="保存的日历时区"
                    value={preferences.timezone}
                    placeholder="选择时区"
                    className="settings-select-menu"
                    groups={[{ options: timezoneOptions }]}
                    onChange={(value) =>
                      setPreferences({ ...preferences, timezone: value })
                    }
                  />
                </Setting>
                <Setting
                  title="防剧透"
                  text="隐藏关注球队最近一场完赛结果。"
                >
                  <Toggle
                    label="防剧透"
                    checked={preferences.spoiler_free}
                    onChange={(value) =>
                      setPreferences({ ...preferences, spoiler_free: value })
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
                    onChange={(value) =>
                      setPreferences({ ...preferences, transparent: value })
                    }
                  />
                </Setting>
              </div>
            </section>

            <section
              className="settings-section"
              aria-labelledby="content-settings-title"
            >
              <div className="settings-section-heading">
                <span className="eyebrow">内容与观看</span>
                <h2 id="content-settings-title">直播入口</h2>
                <p>保存后，赛事详情优先打开该直播方；已核验链接会尝试直达移动端 App。</p>
              </div>
              <BroadcastPreferences
                preferences={preferences}
                onChange={setPreferences}
              />
            </section>

            <section
              className="settings-section"
              aria-labelledby="data-settings-title"
            >
              <div className="settings-section-heading">
                <span className="eyebrow">数据与连接</span>
                <h2 id="data-settings-title">配置、数据源与授权</h2>
                <p>这些操作独立执行，不受页面偏好的保存按钮影响。</p>
              </div>
              <div className="settings-action-grid">
                <div className="settings-action-card">
                  <DownloadSimple size={21} />
                  <div>
                    <h3>导出配置</h3>
                    <p>
                      下载关注和个人规则，不包含凭据或私人订阅地址。
                    </p>
                  </div>
                  <button
                    className="secondary-button"
                    disabled={!user}
                    onClick={() =>
                      run(() =>
                        download(
                          "/me/config/export",
                          "anke-sports-config.json",
                        ),
                      )
                    }
                  >
                    导出 JSON
                  </button>
                </div>
                <div className="settings-action-card">
                  <ArrowClockwise size={21} />
                  <div>
                    <h3>导入已有配置</h3>
                    <p>先预览差异，再选择合并或替换当前配置。</p>
                  </div>
                  <button
                    className="secondary-button"
                    disabled={!user}
                    onClick={() => {
                      setImportError("");
                      setImportOpen(true);
                    }}
                  >
                    开始导入
                  </button>
                </div>
              </div>
              <div
                className="provider-status"
                aria-labelledby="provider-status-title"
              >
                <div className="provider-status-heading">
                  <div>
                    <h3 id="provider-status-title">赛程数据源</h3>
                    <p>只读运行状态，不是个人设置。</p>
                  </div>
                </div>
                {status?.providers.map((provider) => {
                    const active =
                      provider.activity === "queued" ||
                      provider.activity === "running";
                    const waiting = provider.activity === "waiting";
                    const state = provider.error
                      ? "error"
                      : active
                        ? "active"
                        : waiting
                          ? "waiting"
                          : provider.last_success
                            ? "ready"
                            : "idle";
                    const stateLabel = provider.error
                      ? "更新异常"
                      : active
                        ? "正在更新"
                        : waiting
                          ? "等待重试"
                          : provider.last_success
                            ? "运行正常"
                            : "等待首次获取";
                    const name =
                      provider.id === "jolpica"
                        ? "F1 · Jolpica"
                        : provider.id === "balldontlie"
                          ? "NBA · BALLDONTLIE"
                          : "足球 · football-data.org";
                    return (
                      <div className="provider-row" key={provider.id}>
                        <div>
                          <h4>{name}</h4>
                          <p>
                            {provider.error
                              ? provider.error
                              : waiting && provider.next_attempt_at
                                ? `最早重试：${new Date(provider.next_attempt_at).toLocaleString("zh-CN")}`
                                : provider.last_success
                                  ? `上次获取：${new Date(provider.last_success).toLocaleString("zh-CN")}`
                                  : "尚未获取真实赛程"}
                          </p>
                        </div>
                        <span className="provider-state" data-state={state}>
                          {stateLabel}
                        </span>
                        {status.local_preview && (
                          <button
                            className="secondary-button"
                            disabled={!user || busy}
                            onClick={() =>
                              run(
                                () =>
                                  mutate(
                                    `/local/providers/${provider.id}/sync`,
                                    "POST",
                                  ),
                                () =>
                                  flash(
                                    "已加入后台任务；完成后可切换真实赛程查看",
                                  ),
                              )
                            }
                          >
                            <ArrowClockwise size={15} />
                            获取赛程
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>
              <ConnectionManager key={user?.id || "guest"} userId={user?.id} />
            </section>

            <section
              className="settings-section danger-section"
              aria-labelledby="account-settings-title"
            >
              <div className="settings-section-heading">
                <span className="eyebrow">账号</span>
                <h2 id="account-settings-title">删除账号与个人数据</h2>
                <p>
                  删除关注、私人链接与应用授权，并停止私人订阅。系统日历中的缓存仍需在那里删除。
                </p>
              </div>
              <div className="danger-action-row">
                <div>
                  <h3>{accountName}</h3>
                  <p>此操作不可撤销，继续前会再次确认。</p>
                </div>
                <button
                  className="danger-button"
                  disabled={!user || status?.local_preview}
                  onClick={() => setConfirm("delete")}
                >
                  删除账号
                </button>
              </div>
            </section>
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
                <BrandMark size={48} />
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
              <div className="account-profile-heading">
                <label className="avatar-upload">
                  <ProfileAvatar
                    profile={
                      avatarDraft
                        ? { displayName: accountName, photoURL: avatarDraft }
                        : profile
                    }
                    name={accountName}
                    large
                  />
                  <span>
                    {avatarPreparing ? "处理中" : "上传头像"}
                  </span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    disabled={avatarPreparing || profileSaving}
                    onChange={(event) => void chooseAvatar(event)}
                  />
                </label>
              </div>
              {profileAvailable ? (
                <>
                  <label className="form-label">
                    显示名称
                    <input
                      value={profileDraft.displayName}
                      maxLength={80}
                      onChange={(event) =>
                        setProfileDraft({
                          ...profileDraft,
                          displayName: event.target.value,
                        })
                      }
                    />
                  </label>
                </>
              ) : (
                <p>本机体验账号没有 Google 个人资料，正式登录后可在这里修改。</p>
              )}
              <div className="modal-actions account-bottom-actions">
                {profileAvailable && (
                  <button
                    className="primary-button"
                    disabled={profileSaving || avatarPreparing}
                    onClick={() => void saveProfileSettings()}
                  >
                    {profileSaving ? "保存中" : "保存资料"}
                  </button>
                )}
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
              onClose={close}
              onAddToCalendar={() =>
                changeManualCalendar("POST", "已手动加入个人日历")
              }
              onRemoveFromCalendar={() =>
                changeManualCalendar("DELETE", "已移除这场手动加入的比赛")
              }
              onAddLink={() => requireUser(() => setAdding(true))}
              onPin={(id) =>
                requireUser(() =>
                  run(
                    async () => {
                      await mutate(`/me/links/${id}/pin`, "POST");
                      await reloadEvent();
                    },
                    () => flash("链接已固定，后续自动搜索不会覆盖"),
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
      {importOpen && (
        <Modal title="导入已有配置" wide onClose={() => setImportOpen(false)}>
          {(close) => (
            <>
              <button
                className="dialog-close"
                aria-label="关闭导入配置"
                disabled={busy}
                onClick={close}
              >
                <X size={20} />
              </button>
              <span className="eyebrow">数据迁移</span>
              <h2>导入 Anke Sports 配置</h2>
              <p>
                粘贴之前导出的 JSON。我们会先显示差异，不会直接修改当前配置。
              </p>
              <label className="import-field">
                <span>配置 JSON</span>
                <textarea
                  aria-invalid={!!importError || undefined}
                  aria-describedby={
                    importError ? "import-json-error" : "import-json-help"
                  }
                  placeholder={'例如：{ "version": 1, ... }'}
                  value={importText}
                  onChange={(event) => {
                    setImportText(event.target.value);
                    setImportPreview(null);
                    setImportError("");
                  }}
                />
                {importError ? (
                  <span
                    className="field-error"
                    id="import-json-error"
                    role="alert"
                  >
                    <WarningCircle size={15} /> {importError}
                  </span>
                ) : (
                  <small id="import-json-help">
                    仅支持 Anke Sports 导出的 JSON 文件内容。
                  </small>
                )}
              </label>
              <fieldset className="choice-group import-mode-field">
                <legend>导入方式</legend>
                {[
                  ["merge", "合并现有配置"],
                  ["replace", "替换现有配置"],
                ].map(([value, label]) => (
                  <label className="choice-option" key={value}>
                    <input
                      type="radio"
                      name="import-mode"
                      value={value}
                      checked={importMode === value}
                      onChange={() => {
                        setImportMode(value);
                        setImportPreview(null);
                      }}
                    />
                    {label}
                  </label>
                ))}
              </fieldset>
              {importPreview && (
                <div className="import-result" role="status">
                  <b>预览完成</b>
                  <p>
                    新增 {importPreview.added} 项，移除 {importPreview.removed}{" "}
                    项， 无法解析 {importPreview.unresolved.length} 项。
                  </p>
                  {!!importPreview.unresolved.length && (
                    <p>{importPreview.unresolved.join("、")}</p>
                  )}
                </div>
              )}
              <div className="modal-actions">
                <button
                  className="secondary-button"
                  disabled={busy}
                  onClick={close}
                >
                  取消
                </button>
                {!importPreview ? (
                  <button
                    className="primary-button"
                    disabled={!user || !importText.trim() || busy}
                    onClick={() => {
                      let config: unknown;
                      try {
                        config = JSON.parse(importText);
                      } catch {
                        setImportError(
                          "JSON 格式无法解析，请检查引号、逗号和括号是否完整。",
                        );
                        return;
                      }
                      setImportError("");
                      void run(async () =>
                        setImportPreview(
                          await api<ImportPreview>("/me/config/import", {
                            method: "POST",
                            body: JSON.stringify({
                              config,
                              mode: importMode,
                              dry_run: true,
                              expected_revision: user!.revision,
                            }),
                          }),
                        ),
                      );
                    }}
                  >
                    预览差异
                  </button>
                ) : (
                  <button
                    className="primary-button"
                    disabled={busy || !!importPreview.unresolved.length}
                    onClick={() =>
                      void run(
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
                          setImportOpen(false);
                          savedMessage();
                        },
                      )
                    }
                  >
                    确认导入
                  </button>
                )}
              </div>
            </>
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
  onClose,
  onAddToCalendar,
  onRemoveFromCalendar,
  onAddLink,
  onBlock,
  onPin,
  busy,
}: {
  event: SportEvent;
  sources: Source[];
  timezone: string;
  onClose: () => void;
  onAddToCalendar: () => void;
  onRemoveFromCalendar: () => void;
  onAddLink: () => void;
  onBlock: (id: string) => void;
  onPin: (id: string) => void;
  busy: boolean;
}) {
  const manuallyIncluded = Boolean(
    event.calendar?.sources.some((source) => source.type === "manual"),
  );
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
                    logoUrl={p.logo_url || source?.logo_url}
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
          <Clock size={15} />
          预计 {event.duration} 分钟
        </span>
      </div>
      <div className="drawer-calendar-action">
        <button
          className={`drawer-follow ${event.included ? "included" : ""}`}
          disabled={busy || event.included}
          onClick={onAddToCalendar}
        >
          {event.included ? (
            <>
              <CalendarCheck size={18} />
              {manuallyIncluded ? "已手动加入个人日历" : "已加入个人日历"}
            </>
          ) : (
            <>
              <Plus size={18} />
              手动加入个人日历
            </>
          )}
        </button>
        {!event.included && (
          <small>只加入这一场比赛，不会关注整支球队。</small>
        )}
        {event.calendar?.can_remove && (
          <button
            className="text-button drawer-remove-calendar"
            disabled={busy}
            onClick={onRemoveFromCalendar}
          >
            移除这场比赛
          </button>
        )}
      </div>
      <div className="drawer-links">
        {[["live", "观看直播"]].map(([kind, title]) => {
          const links = event.links.filter(
            (l) =>
              l.kind === kind ||
              (kind === "live" && l.kind === "watch_along"),
          );
          return (
            <section key={kind}>
              <h3>
                <Broadcast size={19} />
                {title}
                <span>{links.length || ""}</span>
              </h3>
              {links.length ? (
                links.map((link, index) => (
                  <div
                    className={`content-link${index === 0 ? " content-link-primary" : ""}`}
                    key={link.id}
                  >
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(event) => {
                        if (
                          link.broadcast?.mobile_opening ===
                            "verified_https_app_link" &&
                          /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
                        ) {
                          event.preventDefault();
                          window.location.assign(link.url);
                        }
                      }}
                    >
                      <strong>
                        {link.title}
                        <ArrowUpRight size={15} />
                      </strong>
                      {index === 0 && (
                        <small className="content-link-priority">优先入口</small>
                      )}
                      <small>
                        {link.platform} ·{" "}
                        {link.origin === "manual"
                          ? "手动添加"
                          : link.origin === "confirmed"
                            ? "已人工确认"
                            : link.origin === "official"
                              ? link.broadcast?.content_label === "官方直播产品"
                                ? "官方产品"
                                : "官方审核"
                              : "自动关联"}
                      </small>
                      {link.broadcast?.content_label !== "官方直播产品" && (
                        <small>
                          {link.broadcast
                            ? `${link.broadcast.content_label} · ${link.broadcast.access_label} · ${link.broadcast.region_label}`
                            : "手动添加，观看条件与地区未验证"}
                        </small>
                      )}
                      {link.broadcast &&
                        link.broadcast.content_label !== "官方直播产品" && (
                          <small>
                            {link.broadcast.mobile_opening ===
                            "verified_https_app_link"
                              ? `移动端优先尝试在 ${link.broadcast.platform_name} App 打开，未安装则打开网页`
                              : `在 ${link.broadcast.platform_name} 官方网页打开`}
                          </small>
                        )}
                    </a>
                    {link.broadcast && (
                      <details className="broadcast-evidence">
                        <summary>来源与核验记录</summary>
                        <p>
                          {link.broadcast.content_label === "官方直播产品"
                            ? "版权矩阵核对："
                            : "来源核验："}
                          {new Date(
                            link.broadcast.reviewed_at,
                          ).toLocaleDateString("zh-CN")}{" "}
                          · 到期复查：
                          {link.broadcast.valid_until
                            ? new Date(
                                link.broadcast.valid_until,
                              ).toLocaleDateString("zh-CN")
                            : "按版权方矩阵维护"}
                        </p>
                        <a
                          href={link.broadcast.evidence_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          查看官方来源 ↗
                        </a>
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
                        ) : null}
                      </details>
                    )}
                    {!link.broadcast && (
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
                    )}
                    {link.origin === "manual" && (
                      <button
                        className="icon-button"
                        aria-label={`移除手动链接 ${link.title}`}
                        disabled={busy}
                        onClick={() => onBlock(link.id)}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="link-empty">
                  <span>暂无已确认的本场直播入口</span>
                  <small>按地区和直播偏好自动选择官方产品；也可手动附加并覆盖。</small>
                </div>
              )}
            </section>
          );
        })}
      </div>
      <button className="add-link-button" onClick={onAddLink}>
        <LinkSimple size={17} />
        手动附加链接
        <Plus size={15} />
      </button>
      <details className="description-preview">
        <summary>
          日历描述预览 <CaretRight size={14} />
        </summary>
        {!event.description_in_feed && (
          <p>本场尚未纳入个人日历，以下为预览。</p>
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
  }) => Promise<boolean>;
}) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [localError, setLocalError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setLocalError("");
        const ok = await submit({ url, title });
        if (!ok) setLocalError("链接未保存，请检查是否为安全的 HTTPS 网页地址。");
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
      <h2>把直播入口放在这场比赛里。</h2>
      <p>{event.title}</p>
      <label className="form-label">
        直播入口链接
        <input
          type="url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/live/…"
          autoFocus
        />
      </label>
      <label className="form-label">
        标题（可选）
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例如：官方直播入口"
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
