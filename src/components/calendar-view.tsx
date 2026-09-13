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

export const sportNames: Record<string, string> = {
  basketball: "篮球",
  football: "足球",
  racing: "赛车",
};
export const sportColors: Record<string, string> = {
  basketball: "#f4b979",
  football: "#a3addf",
  racing: "#f38d80",
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
  small = false,
}: {
  short: string;
  color: string;
  small?: boolean;
}) {
  return (
    <span
      className={`team-mark ${small ? "small" : ""}`}
      style={{ "--team-color": color } as React.CSSProperties}
    >
      {short.slice(0, 3)}
    </span>
  );
}

interface Props {
  dataset: string;
  timezone: string;
  sources: Source[];
  epoch: number;
  signedIn: boolean;
  accountId: string | null;
  onEvent: (e: SportEvent) => void;
  onFollowing: () => void;
}

export default function CalendarView({
  dataset,
  timezone,
  sources,
  epoch,
  signedIn,
  accountId,
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
  const [followed, setFollowed] = useState(signedIn);
  const [sport, setSport] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [nextEvent, setNextEvent] = useState<SportEvent | null>(null);
  const [nextState, setNextState] = useState<
    "idle" | "loading" | "complete" | "error"
  >("idle");
  useEffect(() => {
    if (!signedIn || !accountId) {
      setFollowed(false);
      return;
    }
    setFollowed(
      localStorage.getItem(`anke-calendar-scope:${accountId}`) !== "all",
    );
  }, [accountId, signedIn]);
  const selectScope = (nextFollowed: boolean) => {
    setFollowed(nextFollowed);
    if (signedIn && accountId)
      localStorage.setItem(
        `anke-calendar-scope:${accountId}`,
        nextFollowed ? "followed" : "all",
      );
  };
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
    const abort = new AbortController();
    setLoading(true);
    setError("");
    const query = new URLSearchParams({
      ...range,
      dataset,
      followed: String(followed && signedIn),
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
      throw new Error("这个范围的比赛过多，请切换到周视图或我的关注");
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
  }, [range, dataset, followed, signedIn, epoch]);
  const shown = useMemo(
    () =>
      (loadedDataset === dataset ? items : []).filter(
        (e) =>
          (!sport || sport === e.sport) &&
          e.title.toLowerCase().includes(search.toLowerCase()),
      ),
    [items, loadedDataset, dataset, sport, search],
  );
  useEffect(() => {
    if (
      loading ||
      error ||
      shown.length ||
      search ||
      !range.to ||
      (followed && !signedIn)
    ) {
      setNextEvent(null);
      setNextState("idle");
      return;
    }
    const abort = new AbortController();
    const from = new Date(range.to);
    const to = new Date(from);
    to.setUTCDate(to.getUTCDate() + 180);
    const query = new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
      dataset,
      followed: String(followed && signedIn),
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
    followed,
    loading,
    range.to,
    search,
    shown.length,
    signedIn,
    sport,
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
          textColor: "#fff",
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
        <div className="scope-switch">
          <button
            className={!followed ? "active" : ""}
            aria-pressed={!followed}
            onClick={() => selectScope(false)}
          >
            全部赛事
          </button>
          <button
            className={followed ? "active" : ""}
            aria-pressed={followed}
            onClick={() => (signedIn ? selectScope(true) : onFollowing())}
          >
            我的关注
          </button>
        </div>
        <div className="filter-divider" />
        <select
          aria-label="筛选运动"
          value={sport}
          onChange={(e) => setSport(e.target.value)}
        >
          <option value="">所有运动</option>
          {Object.entries(sportNames).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
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
                    {e.participants.length ? (
                      <span className="agenda-teams">
                        {e.participants.map((p) => (
                          <span key={p.id}>
                            <TeamMark
                              short={p.short_name}
                              color={p.color}
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
                    <span className="agenda-venue">
                      {e.venue || "场馆待公布"}
                    </span>
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
              : followed
                ? "这个时间段还没有关注的比赛"
                : "这个时间段暂无赛程"}
          </strong>
          <span>
            {search
              ? "换一个关键词，或清除运动筛选后再试。"
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
          {followed && (
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
