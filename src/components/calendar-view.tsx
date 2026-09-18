"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import FullCalendar, {
  useCalendarController,
  type DatesSetInfo,
} from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import themePlugin from "@fullcalendar/react/themes/monarch";
import zhCn from "@fullcalendar/react/locales/zh-cn";
import {
  CaretLeft,
  CaretRight,
  Clock,
  FlagCheckered,
  LinkSimple,
  CalendarBlank,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import { api } from "@/lib/api";
import type { Source, SportEvent } from "@/lib/types";
import {
  defaultCompetitionSourceId,
  defaultScheduleSourceId,
  ScheduleSourcePicker,
} from "./schedule-source-picker";
import { SelectMenu } from "./select-menu";

export const sportNames: Record<string, string> = {
  basketball: "篮球",
  football: "足球",
  racing: "赛车",
};
export const sportColors: Record<string, string> = {
  basketball: "var(--color-sport-basketball)",
  football: "var(--color-sport-football)",
  racing: "var(--color-sport-racing)",
};
export function timeOf(event: SportEvent, timezone: string) {
  return event.starts_at
    ? new Intl.DateTimeFormat("zh-CN", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(event.starts_at))
    : "时间待定";
}
export function leagueOf(event: SportEvent, sources: Source[]) {
  return (
    sources.find((s) => s.id === event.competition_id)?.short_name ||
    (event.sport === "racing"
      ? "F1"
      : event.sport === "basketball"
        ? "NBA"
        : "足球")
  );
}
export function TeamMark({
  short,
  color,
  logoUrl,
  small = false,
}: {
  short: string;
  color: string;
  logoUrl?: string | null;
  small?: boolean;
}) {
  return (
    <span
      className={`team-mark ${logoUrl ? "has-logo" : ""} ${small ? "small" : ""}`}
      style={{ "--team-color": color } as React.CSSProperties}
    >
      <span className="team-mark-fallback">{short.slice(0, 3)}</span>
      {logoUrl && (
        <img
          className="team-mark-logo"
          src={logoUrl}
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

interface Props {
  dataset: string;
  timezone: string;
  sources: Source[];
  epoch: number;
  signedIn: boolean;
  teamSourceId?: string;
  teamSource?: Source;
  onEvent: (e: SportEvent) => void;
  onFollowing: () => void;
}

type CalendarScope = "followed" | "all";

const calendarScopeStorageKey = "anke-calendar-scope";

export default function CalendarView({
  dataset,
  timezone,
  sources,
  epoch,
  signedIn,
  teamSourceId = "",
  teamSource,
  onEvent,
  onFollowing,
}: Props) {
  const controller = useCalendarController();
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-height: 850px)");
    const update = () => setCompact(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  const [view, setView] = useState("dayGridMonth");
  const [title, setTitle] = useState("");
  const [range, setRange] = useState({ from: "", to: "" });
  const [items, setItems] = useState<SportEvent[]>([]);
  const [loadedDataset, setLoadedDataset] = useState("");
  const [guestSourceId, setGuestSourceId] = useState("");
  const [allSourceId, setAllSourceId] = useState("");
  const [scope, setScope] = useState<CalendarScope>("followed");
  const [sport, setSport] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [nextEvent, setNextEvent] = useState<SportEvent | null>(null);
  const [nextState, setNextState] = useState<
    "idle" | "loading" | "complete" | "error"
  >("idle");
  const teamCalendar = Boolean(teamSourceId && teamSource?.kind === "team");
  const guestSources = useMemo(
    () =>
      sources.filter(
        (source) => source.kind === "team",
      ),
    [sources],
  );
  const allFilterSources = useMemo(
    () =>
      sources.filter(
        (source) => source.kind === "team" || source.kind === "competition",
      ),
    [sources],
  );
  const sourceById = useMemo(
    () => new Map(sources.map((source) => [source.id, source])),
    [sources],
  );
  const defaultAllSourceId = useMemo(
    () => defaultCompetitionSourceId(allFilterSources),
    [allFilterSources],
  );
  const allMatches = signedIn && scope === "all";
  useEffect(() => {
    if (!signedIn) {
      setScope("followed");
      return;
    }
    setScope(
      window.localStorage.getItem(calendarScopeStorageKey) === "all"
        ? "all"
        : "followed",
    );
  }, [signedIn]);
  useEffect(() => {
    if (signedIn || !guestSources.length) return;
    setGuestSourceId((current) => {
      if (guestSources.some((source) => source.id === current)) return current;
      return defaultScheduleSourceId(guestSources) || guestSources[0].id;
    });
  }, [dataset, guestSources, signedIn]);
  useEffect(() => {
    if (
      allSourceId &&
      allFilterSources.some((source) => source.id === allSourceId)
    )
      return;
    if (defaultAllSourceId) setAllSourceId(defaultAllSourceId);
  }, [allFilterSources, allSourceId, defaultAllSourceId]);
  const guestSource = guestSources.find(
    (source) => source.id === guestSourceId,
  );
  const dates = useCallback(
    (info: DatesSetInfo) => {
      const formatter = new Intl.DateTimeFormat("zh-CN", {
        timeZone: timezone,
        year: "numeric",
        month: "numeric",
        day: "numeric",
      });
      setTitle(
        info.view.type === "timeGridWeek"
          ? formatter.formatRange(
              new Date(info.startStr),
              new Date(new Date(info.endStr).getTime() - 1),
            )
          : info.view.title,
      );
      const dateRange = { from: info.startStr, to: info.endStr };
      setRange((previous) =>
        previous.from === dateRange.from && previous.to === dateRange.to
          ? previous
          : dateRange,
      );
    },
    [timezone],
  );
  useEffect(() => {
    if (!range.from) return;
    if (!teamCalendar && signedIn && scope === "all" && !defaultAllSourceId) {
      setItems([]);
      setLoadedDataset("");
      setLoading(true);
      setError("");
      return;
    }
    if (!teamCalendar && !signedIn && !guestSourceId) {
      setItems([]);
      setLoadedDataset(dataset);
      setLoading(false);
      setError("");
      return;
    }
    const abort = new AbortController();
    setLoading(true);
    setError("");
    const followed = !teamCalendar && signedIn && scope === "followed";
    const sourceId = teamCalendar
      ? teamSourceId
      : followed
      ? ""
      : signedIn
        ? allSourceId || defaultAllSourceId
        : guestSourceId;
    const query = new URLSearchParams({
      ...range,
      dataset,
      followed: String(followed),
      source_id: sourceId,
    });
    async function loadPages() {
      const items: SportEvent[] = [];
      for (let page = 0; page < 20; page++) {
        const data = await api<{
          items: SportEvent[];
          next_cursor: string | null;
        }>(`/events?${query}`, { signal: abort.signal });
        items.push(...data.items);
        if (!data.next_cursor) return items;
        query.set("cursor", data.next_cursor);
      }
      throw new Error("这个范围的比赛过多，请切换到周视图");
    }
    loadPages()
      .then((items) => {
        setItems(items);
        setLoadedDataset(dataset);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });
    return () => abort.abort();
  }, [
    range,
    dataset,
    guestSourceId,
    allSourceId,
    defaultAllSourceId,
    signedIn,
    scope,
    teamCalendar,
    teamSourceId,
    epoch,
  ]);
  const shown = useMemo(
    () =>
      (loadedDataset === dataset ? items : []).filter(
        (e) =>
          (!signedIn || teamCalendar || !sport || sport === e.sport) &&
          e.title.toLowerCase().includes(search.toLowerCase()),
      ),
    [items, loadedDataset, dataset, signedIn, sport, search, teamCalendar],
  );
  useEffect(() => {
    if (
      loading ||
      error ||
      shown.length ||
      search ||
      !range.to ||
      (!teamCalendar && !signedIn && !guestSourceId)
    ) {
      setNextEvent(null);
      setNextState("idle");
      return;
    }
    const abort = new AbortController();
    const from = new Date(range.to);
    const to = new Date(from);
    to.setUTCDate(to.getUTCDate() + 180);
    const followed = !teamCalendar && signedIn && scope === "followed";
    const sourceId = teamCalendar
      ? teamSourceId
      : followed
      ? ""
      : signedIn
        ? allSourceId || defaultAllSourceId
        : guestSourceId;
    const query = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
      dataset,
      followed: String(followed),
      source_id: sourceId,
      limit: "500",
    });
    setNextEvent(null);
    setNextState("loading");
    async function findNext() {
      for (let page = 0; page < 20; page++) {
        const data = await api<{
          items: SportEvent[];
          next_cursor: string | null;
        }>(`/events?${query}`, { signal: abort.signal });
        const match = data.items.find(
          (event) => !sport || event.sport === sport,
        );
        if (match) return match;
        if (!data.next_cursor) return null;
        query.set("cursor", data.next_cursor);
      }
      return null;
    }
    findNext()
      .then((event) => {
        if (!abort.signal.aborted) {
          setNextEvent(event);
          setNextState("complete");
        }
      })
      .catch(() => {
        if (!abort.signal.aborted) {
          setNextEvent(null);
          setNextState("error");
        }
      });
    return () => abort.abort();
  }, [
    dataset,
    error,
    guestSourceId,
    allSourceId,
    defaultAllSourceId,
    loading,
    range.to,
    search,
    shown.length,
    signedIn,
    scope,
    sport,
    teamCalendar,
    teamSourceId,
  ]);
  const fcEvents = useMemo(
    () =>
      shown
        .filter((e) => e.starts_at || e.local_date)
        .map((e) => ({
          id: e.id,
          title: e.title,
          start: e.starts_at || e.local_date!,
          end: e.starts_at
            ? new Date(
                new Date(e.starts_at).getTime() + e.duration * 60000,
              ).toISOString()
            : undefined,
          allDay: e.time_precision !== "exact",
          backgroundColor: "transparent",
          borderColor: "transparent",
          textColor: "var(--color-accent-ink)",
          extendedProps: { data: e },
        })),
    [shown],
  );
  const weekScrollTime = useMemo(() => {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const firstMinute = shown.reduce<number | null>((earliest, event) => {
      if (!event.starts_at) return earliest;
      const parts = formatter.formatToParts(new Date(event.starts_at));
      const minuteOfDay =
        Number(parts.find((part) => part.type === "hour")?.value || 0) * 60 +
        Number(parts.find((part) => part.type === "minute")?.value || 0);
      return earliest === null ? minuteOfDay : Math.min(earliest, minuteOfDay);
    }, null);
    if (firstMinute === null) return "07:00:00";
    const scrollMinutes = Math.max(0, firstMinute - 60);
    return `${String(Math.floor(scrollMinutes / 60)).padStart(2, "0")}:${String(scrollMinutes % 60).padStart(2, "0")}:00`;
  }, [shown, timezone]);
  const changeView = (value: string) => {
    setView(value);
    if (value !== "agenda") controller.changeView(value);
  };
  const changeScope = (value: CalendarScope) => {
    setScope(value);
    setSport("");
    window.localStorage.setItem(calendarScopeStorageKey, value);
  };
  const groups = useMemo(() => {
    const grouped: Record<string, SportEvent[]> = {};
    shown.forEach((e) => {
      const key = e.starts_at
        ? new Intl.DateTimeFormat("sv-SE", { timeZone: timezone }).format(
            new Date(e.starts_at),
          )
        : e.local_date || "时间待定";
      (grouped[key] ||= []).push(e);
    });
    return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
  }, [shown, timezone]);
  return (
    <section className="calendar-area">
      <div className="calendar-toolbar">
        <div className="date-controls">
          <h2>{title || "比赛日历"}</h2>
          <div className="arrows">
            <button
              className="icon-button"
              aria-label="上一个日期范围"
              onClick={() => controller.prev()}
            >
              <CaretLeft />
            </button>
            <button
              className="icon-button"
              aria-label="下一个日期范围"
              onClick={() => controller.next()}
            >
              <CaretRight />
            </button>
          </div>
          <button className="today-button" onClick={() => controller.today()}>
            今天
          </button>
        </div>
        <div className="view-segment" aria-label="日历视图">
          {[
            ["dayGridMonth", "月"],
            ["timeGridWeek", "周"],
            ["agenda", "日程"],
          ].map(([value, label]) => (
            <button
              key={value}
              aria-pressed={view === value}
              className={view === value ? "active" : ""}
              onClick={() => changeView(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="calendar-filters">
        {teamCalendar ? (
          <a className="calendar-team-back" href="/calendar">
            返回我的日历
          </a>
        ) : signedIn ? (
          <div className="calendar-scope" aria-label="比赛范围">
            <button
              type="button"
              aria-pressed={scope === "followed"}
              className={scope === "followed" ? "active" : ""}
              onClick={() => changeScope("followed")}
            >
              我的关注
            </button>
            <button
              type="button"
              aria-pressed={scope === "all"}
              className={scope === "all" ? "active" : ""}
              onClick={() => changeScope("all")}
            >
              全部比赛
            </button>
          </div>
        ) : null}
        {!teamCalendar && signedIn && scope === "all" ? (
          <ScheduleSourcePicker
            sources={sources}
            selectedSourceId={allSourceId}
            onSelect={setAllSourceId}
            allowAll
            searchable
            className="calendar-source-picker calendar-all-source-picker"
          />
        ) : !teamCalendar && signedIn ? (
          <SelectMenu
            ariaLabel="筛选运动"
            value={sport}
            placeholder="所有运动"
            className="select-menu--quiet calendar-sport-menu"
            groups={[
              {
                options: [
                  { value: "", label: "所有运动" },
                  ...Object.entries(sportNames).map(([value, label]) => ({
                    value,
                    label,
                  })),
                ],
              },
            ]}
            onChange={setSport}
          />
        ) : !teamCalendar ? (
          <ScheduleSourcePicker
            sources={sources}
            selectedSourceId={guestSourceId}
            onSelect={setGuestSourceId}
            className="calendar-source-picker"
          />
        ) : null}
        <label className="calendar-search">
          <MagnifyingGlass size={16} />
          <input
            placeholder="查找比赛"
            aria-label="查找比赛"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <span className="match-count">
          {loading ? "获取赛程中" : `${shown.length} 场比赛`}
        </span>
      </div>
      {error && (
        <div className="inline-error" role="alert">
          {error}
        </div>
      )}
      <div
        className={`calendar-engine ${view === "agenda" ? "engine-hidden" : ""} ${view === "timeGridWeek" ? "is-week" : ""}`}
        aria-busy={loading}
      >
        <FullCalendar
          controller={controller}
          plugins={[themePlugin, dayGridPlugin, timeGridPlugin]}
          initialView="dayGridMonth"
          locale={zhCn}
          firstDay={1}
          timeZone={timezone}
          height="100%"
          headerToolbar={false}
          events={fcEvents}
          datesSet={dates}
          editable={false}
          eventStartEditable={false}
          eventDurationEditable={false}
          dayMaxEvents={compact ? 1 : 2}
          expandRows={true}
          eventDisplay="block"
          className="anke-calendar"
          eventClass="anke-calendar-entry"
          eventInnerClass="anke-calendar-entry-inner"
          dayCellClass={(info) =>
            `anke-calendar-day ${info.isToday ? "is-today" : ""}`
          }
          dayCellTopClass="anke-calendar-day-top"
          fixedWeekCount={false}
          showNonCurrentDates={true}
          slotMinTime="00:00:00"
          slotMaxTime="24:00:00"
          scrollTime={view === "timeGridWeek" ? weekScrollTime : "07:00:00"}
          scrollTimeReset={true}
          nowIndicator={false}
          allDayText="时间待定"
          eventClick={(info) =>
            onEvent(info.event.extendedProps.data as SportEvent)
          }
          eventContent={(info) => {
            const e = info.event.extendedProps.data as SportEvent;
            return (
              <div
                className={`calendar-event ${e.status === "cancelled" ? "cancelled" : ""}`}
                style={
                  {
                    "--sport-color": sportColors[e.sport],
                  } as React.CSSProperties
                }
              >
                <div className="event-meta">
                  <time>{timeOf(e, timezone)}</time>
                  <span>{leagueOf(e, sources)}</span>
                  {e.links.length > 0 && <LinkSimple size={11} />}
                </div>
                <div className="event-name">
                  {e.sport === "racing" ? (
                    <>
                      <FlagCheckered size={13} />
                      <span>{e.title}</span>
                    </>
                  ) : (
                    <>
                      <span>
                        {e.participants.map((p) => p.short_name).join(" · ")}
                      </span>
                      <span className="event-team-names">
                        {e.participants
                          .map((p) =>
                            p.name.replace(
                              /洛杉矶|金州|波士顿|纽约|曼彻斯特/g,
                              "",
                            ),
                          )
                          .join(" vs ")}
                      </span>
                    </>
                  )}
                </div>
                {e.included && (
                  <span className="follow-tick" aria-label="已加入个人日历">
                    ✓
                  </span>
                )}
              </div>
            );
          }}
        />
      </div>
      {view === "agenda" && (
        <div className="agenda-list">
          {groups.map(([day, games]) => (
            <section className="agenda-day" key={day}>
              <div className="agenda-date">
                {day !== "时间待定" ? (
                  <>
                    <strong>{Number(day.slice(8))}</strong>
                    <span>
                      {new Intl.DateTimeFormat("zh-CN", {
                        weekday: "long",
                      }).format(new Date(`${day}T12:00:00`))}
                    </span>
                  </>
                ) : (
                  day
                )}
              </div>
              <div className="agenda-games">
                {games.map((e) => (
                  <button
                    className="agenda-game"
                    key={e.id}
                    onClick={() => onEvent(e)}
                  >
                    <span className="agenda-time">
                      {timeOf(e, timezone)}
                      <small>{leagueOf(e, sources)}</small>
                    </span>
                    {e.sport === "racing" ? (
                      <span className="racing-title">
                        <FlagCheckered size={28} />
                        <b>{e.title}</b>
                      </span>
                    ) : e.participants.length ? (
                      <span className="agenda-teams">
                        {e.participants.map((p) => (
                          <span key={p.id}>
                            <TeamMark
                              short={p.short_name}
                              color={p.color}
                              logoUrl={p.logo_url || sourceById.get(p.id)?.logo_url}
                              small
                            />
                            <b>{p.name}</b>
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span className="racing-title">
                        <FlagCheckered size={28} />
                        <b>{e.title}</b>
                      </span>
                    )}
                    <CaretRight size={18} />
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      {!loading && !error && !shown.length && (
        <div className="calendar-empty">
          <CalendarBlank size={30} />
          <strong>
            {search
              ? "没有找到对应比赛"
              : teamCalendar
                ? `${teamSource?.name || "这支球队"}在这个时间段暂无赛程`
                : !signedIn && !guestSourceId
              ? "请选择一支球队"
                : signedIn
                  ? allMatches
                    ? "这个时间段还没有已接入比赛"
                    : "这个时间段还没有关注的比赛"
                  : `${guestSource?.name || "所选对象"}在这个时间段暂无赛程`}
          </strong>
          <span>
            {search
              ? "换一个关键词，或清除运动筛选后再试。"
              : teamCalendar
                ? "已接入的其他赛事也会显示在这里。"
                : !signedIn && !guestSourceId
              ? "选择 NBA 或英超球队后，这里会显示对应赛程。"
                : nextState === "loading"
                  ? "正在查找下一场比赛…"
                  : nextEvent
                    ? `下一场：${nextEvent.title} · ${new Intl.DateTimeFormat(
                        "zh-CN",
                        {
                          timeZone: timezone,
                          month: "long",
                          day: "numeric",
                          hour: nextEvent.starts_at ? "2-digit" : undefined,
                          minute: nextEvent.starts_at ? "2-digit" : undefined,
                        },
                      ).format(
                        new Date(
                          nextEvent.starts_at ||
                            `${nextEvent.local_date}T12:00:00`,
                        ),
                      )}`
                    : nextState === "error"
                      ? "暂时无法查询下一场比赛，可切换日期后再试。"
                      : "已检查随后 180 天的已接入赛程，暂时没有匹配比赛。"}
          </span>
          {signedIn && !teamCalendar && (
            <button className="text-button" onClick={onFollowing}>
              管理我的关注
            </button>
          )}
        </div>
      )}
      <footer className="calendar-footer">
        <div className="sport-legend">
          {Object.entries(sportNames).map(([key, label]) => (
            <span key={key}>
              <i style={{ background: sportColors[key] }} />
              {label}
            </span>
          ))}
        </div>
        <span>
          <Clock size={13} /> {timezone} ·{" "}
          {dataset === "demo"
            ? "演示赛程，不代表真实比赛"
            : "时间以赛事官方公布为准"}
        </span>
      </footer>
    </section>
  );
}
