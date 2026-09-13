"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowClockwise,
  ArrowUpRight,
  Check,
  Pause,
  Play,
  Plus,
  Trash,
  YoutubeLogo,
} from "@phosphor-icons/react";
import { api } from "@/lib/api";
import type {
  CalendarUser,
  CreatorIdentity,
  CreatorRemovalImpact,
  CreatorFollow,
  Review,
  ServiceStatus,
  Source,
} from "@/lib/types";

const labels: Record<string, string> = {
  BOTH_TEAMS_FOUND: "找到比赛双方",
  ONE_TEAM_ONLY: "只找到一方球队",
  RACE_FOUND: "找到大奖赛名称",
  SESSION_FOUND: "找到具体分场次",
  SESSION_AMBIGUOUS: "具体分场次不明确",
  EXPLICIT_DATE: "找到比赛日期",
  NO_EXPLICIT_DATE: "缺少明确日期",
  DATE_AMBIGUOUS: "日期有多种解释，需要确认",
  TITLE_SUBJECT_UNCLEAR: "标题未明确比赛对象",
  TITLE_PHASE_UNCLEAR: "标题未明确前瞻或复盘",
  PHASE_UNKNOWN: "前瞻或复盘类型待确认",
  MULTIPLE_CANDIDATES: "可能对应多场比赛",
  MATCH_NOT_FINISHED: "视频发布时比赛可能尚未结束",
};
type Draft = Pick<
  CreatorFollow,
  "scope_keys" | "preview" | "recap" | "enabled"
>;
const defaults: Draft = {
  scope_keys: [],
  preview: true,
  recap: true,
  enabled: true,
};
const REVIEW_PAGE_SIZE = 20;
type Props = {
  user: CalendarUser | null;
  budget?: ServiceStatus["youtube_budget"];
  sources: Source[];
  epoch: number;
  busy: boolean;
  requireUser: (action: () => void) => void;
  run: (
    action: () => Promise<unknown>,
    success?: () => void,
  ) => Promise<boolean>;
};
const write = (path: string, method: string, data?: unknown) =>
  api(path, { method, ...(data ? { body: JSON.stringify(data) } : {}) });

function ScopeFields({
  value,
  onChange,
  sources,
}: {
  value: Draft;
  onChange: (value: Draft) => void;
  sources: Source[];
}) {
  return (
    <div className="creator-options">
      <fieldset>
        <legend>附加内容</legend>
        <label>
          <input
            type="checkbox"
            checked={value.preview}
            onChange={(e) => onChange({ ...value, preview: e.target.checked })}
          />
          赛前前瞻
        </label>
        <label>
          <input
            type="checkbox"
            checked={value.recap}
            onChange={(e) => onChange({ ...value, recap: e.target.checked })}
          />
          赛后复盘
        </label>
      </fieldset>
      <fieldset>
        <legend>对应哪些关注</legend>
        <label>
          <input
            type="checkbox"
            checked={!value.scope_keys.length}
            onChange={(e) => {
              if (e.target.checked) onChange({ ...value, scope_keys: [] });
            }}
          />
          我的所有关注
        </label>
        <div className="scope-options">
          {sources.map((source) => (
            <label key={source.id}>
              <input
                type="checkbox"
                checked={value.scope_keys.includes(source.id)}
                onChange={(e) =>
                  onChange({
                    ...value,
                    scope_keys: e.target.checked
                      ? [...value.scope_keys, source.id]
                      : value.scope_keys.filter((k) => k !== source.id),
                  })
                }
              />
              {source.name}
            </label>
          ))}
        </div>
        <p>选择范围后，只匹配其中已加入个人日历的比赛。</p>
      </fieldset>
    </div>
  );
}

export function CreatorManager({
  user,
  budget,
  sources,
  epoch,
  busy,
  requireUser,
  run,
}: Props) {
  const [url, setUrl] = useState("");
  const [identity, setIdentity] = useState<CreatorIdentity | null>(null);
  const [draft, setDraft] = useState<Draft>(defaults);
  const [editing, setEditing] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(defaults);
  const [deletion, setDeletion] = useState<
    (CreatorRemovalImpact & { id: string; name: string }) | null
  >(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewError, setReviewError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reviewSearch, setReviewSearch] = useState("");
  const [reviewCreator, setReviewCreator] = useState("");
  const [reviewSort, setReviewSort] = useState<"oldest" | "newest" | "event">(
    "oldest",
  );
  const [groupReviews, setGroupReviews] = useState(true);
  const [reviewPage, setReviewPage] = useState(1);
  const [selectedReviews, setSelectedReviews] = useState<Set<string>>(
    new Set(),
  );
  const [reviewKinds, setReviewKinds] = useState<
    Record<string, "preview" | "recap">
  >({});
  useEffect(() => {
    if (!user) {
      setReviews([]);
      setLoading(false);
      return;
    }
    let active = true;
    const load = async () => {
      try {
        const data = await api<{ items: Review[] }>("/me/reviews");
        if (active) {
          setReviews((current) => {
            const signature = (items: Review[]) =>
              items.map((item) => `${item.id}:${item.updated_at}`).join("|");
            return signature(current) === signature(data.items)
              ? current
              : data.items;
          });
          setReviewKinds((current) => {
            const next = { ...current };
            let changed = false;
            data.items.forEach((review) => {
              if (!next[review.id]) {
                next[review.id] = review.kind === "recap" ? "recap" : "preview";
                changed = true;
              }
            });
            return changed ? next : current;
          });
          setReviewError("");
        }
      } catch (e) {
        if (active)
          setReviewError(
            e instanceof Error ? e.message : "待确认内容暂时无法加载",
          );
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    const timer = setInterval(refreshWhenVisible, 30000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [user?.id, epoch]);
  const creators = useMemo(
    () => Array.from(new Set(reviews.map((review) => review.creator))).sort(),
    [reviews],
  );
  const visibleReviews = useMemo(() => {
    const query = reviewSearch.trim().toLocaleLowerCase("zh-CN");
    return reviews
      .filter(
        (review) =>
          (!reviewCreator || review.creator === reviewCreator) &&
          (!query ||
            `${review.title} ${review.creator} ${review.event_title}`
              .toLocaleLowerCase("zh-CN")
              .includes(query)),
      )
      .sort((a, b) => {
        if (reviewSort === "event")
          return (a.starts_at || "9999").localeCompare(b.starts_at || "9999");
        const order = a.published_at.localeCompare(b.published_at);
        return reviewSort === "newest" ? -order : order;
      });
  }, [reviews, reviewCreator, reviewSearch, reviewSort]);
  const reviewPageCount = Math.max(
    1,
    Math.ceil(visibleReviews.length / REVIEW_PAGE_SIZE),
  );
  useEffect(() => {
    setReviewPage((current) => Math.min(current, reviewPageCount));
  }, [reviewPageCount]);
  useEffect(() => setReviewPage(1), [reviewSearch, reviewCreator, reviewSort]);
  useEffect(() => {
    const ids = new Set(reviews.map((review) => review.id));
    setSelectedReviews(
      (current) => new Set([...current].filter((id) => ids.has(id))),
    );
  }, [reviews]);
  const pagedReviews = visibleReviews.slice(
    (reviewPage - 1) * REVIEW_PAGE_SIZE,
    reviewPage * REVIEW_PAGE_SIZE,
  );
  const reviewGroups = useMemo(() => {
    if (!groupReviews) return [{ key: "all", label: "", items: pagedReviews }];
    const grouped = new Map<string, Review[]>();
    pagedReviews.forEach((review) => {
      const key = `${review.event_id}:${review.event_title}`;
      grouped.set(key, [...(grouped.get(key) || []), review]);
    });
    return [...grouped.entries()].map(([key, items]) => ({
      key,
      label: items[0].event_title,
      items,
    }));
  }, [groupReviews, pagedReviews]);
  const toggleReview = useCallback((id: string, selected: boolean) => {
    setSelectedReviews((current) => {
      const next = new Set(current);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);
  const decideMany = (decision: "confirm" | "ignore") => {
    const selected = reviews.filter((review) => selectedReviews.has(review.id));
    return run(
      () =>
        Promise.all(
          selected.map((review) =>
            write(`/me/reviews/${review.id}`, "POST", {
              decision,
              kind: reviewKinds[review.id] || "preview",
              expected_updated_at: review.updated_at,
            }),
          ),
        ),
      () => {
        const ids = new Set(selected.map((review) => review.id));
        setReviews((current) =>
          current.filter((review) => !ids.has(review.id)),
        );
        setSelectedReviews(new Set());
      },
    );
  };
  const saveEdit = () =>
    run(
      () =>
        write(`/me/creators/${editing}`, "PATCH", {
          ...editDraft,
          expected_revision: user!.revision,
        }),
      () => setEditing(null),
    );
  return (
    <div className="management-page creators-page">
      <div className="section-toolbar">
        <div>
          <h2>我的创作者</h2>
        </div>
        <span className="count-label">
          {user?.creators.length || 0} 位创作者
        </span>
      </div>
      {budget?.state === "waiting" && (
        <div className="info-note creator-wait" role="status">
          <Pause size={18} />
          <span>
            YouTube 更新暂缓。
            {budget.resume_at &&
              `最早于 ${new Date(budget.resume_at).toLocaleString("zh-CN", { timeZone: user?.config.preferences.timezone || "Asia/Shanghai", hour12: false })}（${user?.config.preferences.timezone || "Asia/Shanghai"}）自动重试。`}
            已有日历与视频链接继续保留，待确认内容仍可处理。
          </span>
        </div>
      )}
      <form
        className="creator-form"
        onSubmit={(e) => {
          e.preventDefault();
          requireUser(() =>
            run(async () => {
              const resolved = await api<CreatorIdentity>(
                "/me/creators/resolve",
                { method: "POST", body: JSON.stringify({ url }) },
              );
              setIdentity(resolved);
              setDraft(defaults);
            }),
          );
        }}
      >
        <YoutubeLogo size={26} />
        <input
          required
          aria-label="创作者链接"
          placeholder="YouTube 频道链接、@handle 或视频链接"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setIdentity(null);
          }}
        />
        <button className="primary-button" disabled={busy}>
          <Plus size={16} />
          查找创作者
        </button>
      </form>
      {identity && (
        <section className="creator-editor" aria-label="确认创作者">
          <div className="section-toolbar">
            <div>
              <span className="eyebrow">确认频道</span>
              <h3>{identity.name}</h3>
              <a href={identity.url} target="_blank" rel="noopener noreferrer">
                在 YouTube 查看频道 <ArrowUpRight size={13} />
              </a>
            </div>
          </div>
          <ScopeFields sources={sources} value={draft} onChange={setDraft} />
          <div className="creator-actions">
            <button
              className="secondary-button"
              onClick={() => setIdentity(null)}
            >
              取消
            </button>
            <button
              className="primary-button"
              disabled={busy}
              onClick={() =>
                run(
                  () =>
                    write("/me/creators", "POST", {
                      url: identity.url,
                      scope_keys: draft.scope_keys,
                      preview: draft.preview,
                      recap: draft.recap,
                      expected_revision: user!.revision,
                    }),
                  () => {
                    setIdentity(null);
                    setUrl("");
                  },
                )
              }
            >
              <Check size={16} />
              确认关注
            </button>
          </div>
        </section>
      )}
      {user?.creators.length ? (
        <div className="creator-list">
          {user.creators.map((creator) => (
            <section className="managed-creator" key={creator.channel_id}>
              <div className="creator-row">
                <span className="creator-avatar">
                  <YoutubeLogo size={24} />
                </span>
                <div className="creator-summary">
                  <b>{creator.name}</b>
                  <p>
                    {creator.scope_keys
                      .map(
                        (key) => sources.find((s) => s.id === key)?.name || key,
                      )
                      .join("、") || "我的所有关注"}{" "}
                    ·{" "}
                    {[creator.preview && "前瞻", creator.recap && "复盘"]
                      .filter(Boolean)
                      .join("、") || "未启用内容类型"}
                  </p>
                  <p className={creator.last_error ? "creator-sync-error" : ""}>
                    {!creator.enabled
                      ? "已暂停新视频关联，保留已有链接"
                      : creator.sync_status === "syncing"
                        ? budget?.state === "waiting"
                          ? "等待 YouTube 恢复更新"
                          : "正在检查频道更新…"
                        : creator.last_error
                          ? creator.last_error === "YOUTUBE_KEY_REQUIRED"
                            ? "尚未配置 YouTube 服务，暂时无法更新"
                            : "上次更新未完成，可稍后重试"
                          : creator.last_synced_at
                            ? `上次检查 ${new Date(creator.last_synced_at).toLocaleString("zh-CN")}`
                            : "等待首次检查"}
                  </p>
                </div>
                <div className="creator-row-actions">
                  <button
                    className="icon-button"
                    title={creator.enabled ? "暂停更新" : "恢复更新"}
                    aria-label={`${creator.enabled ? "暂停" : "恢复"} ${creator.name}`}
                    disabled={busy}
                    onClick={() =>
                      run(() =>
                        write(`/me/creators/${creator.channel_id}`, "PATCH", {
                          scope_keys: creator.scope_keys,
                          preview: creator.preview,
                          recap: creator.recap,
                          enabled: !creator.enabled,
                          expected_revision: user.revision,
                        }),
                      )
                    }
                  >
                    {creator.enabled ? <Pause size={17} /> : <Play size={17} />}
                  </button>
                  <button
                    className="icon-button"
                    title="检查更新"
                    aria-label={`检查 ${creator.name} 更新`}
                    disabled={
                      busy ||
                      !creator.enabled ||
                      creator.sync_status === "syncing"
                    }
                    onClick={() =>
                      run(() =>
                        write(
                          `/me/creators/${creator.channel_id}/refresh`,
                          "POST",
                        ),
                      )
                    }
                  >
                    <ArrowClockwise size={17} />
                  </button>
                  <button
                    className="secondary-button"
                    disabled={busy}
                    onClick={() => {
                      setEditing(
                        editing === creator.channel_id
                          ? null
                          : creator.channel_id,
                      );
                      setEditDraft({
                        scope_keys: creator.scope_keys,
                        preview: creator.preview,
                        recap: creator.recap,
                        enabled: creator.enabled,
                      });
                    }}
                  >
                    偏好
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`删除 ${creator.name}`}
                    disabled={busy}
                    onClick={() =>
                      run(async () => {
                        const impact = await api<CreatorRemovalImpact>(
                          `/me/creators/${creator.channel_id}/impact`,
                        );
                        setDeletion({
                          ...impact,
                          id: creator.channel_id,
                          name: creator.name,
                        });
                      })
                    }
                  >
                    <Trash size={17} />
                  </button>
                </div>
              </div>
              {editing === creator.channel_id && (
                <div className="creator-editor">
                  <ScopeFields
                    value={editDraft}
                    onChange={setEditDraft}
                    sources={sources}
                  />
                  <div className="creator-actions">
                    <button
                      className="secondary-button"
                      onClick={() => setEditing(null)}
                    >
                      取消
                    </button>
                    <button
                      className="primary-button"
                      disabled={busy}
                      onClick={saveEdit}
                    >
                      保存偏好
                    </button>
                  </div>
                </div>
              )}
              {deletion?.id === creator.channel_id && (
                <div
                  className="creator-delete"
                  role="region"
                  aria-label="确认删除创作者"
                >
                  <h3>停止关注 {deletion.name}？</h3>
                  <p>
                    将移除 {deletion.automatic_removed} 条自动关联，保留{" "}
                    {deletion.manual_retained}{" "}
                    条手动添加或固定链接。比赛和球队关注会继续保留。
                  </p>
                  <div className="creator-actions">
                    <button
                      className="secondary-button"
                      onClick={() => setDeletion(null)}
                    >
                      取消
                    </button>
                    <button
                      className="danger-button"
                      disabled={busy}
                      onClick={() =>
                        run(
                          () =>
                            write(
                              `/me/creators/${deletion.id}?expected_revision=${deletion.revision}&confirmed=true`,
                              "DELETE",
                            ),
                          () => setDeletion(null),
                        )
                      }
                    >
                      确认删除创作者
                    </button>
                  </div>
                </div>
              )}
            </section>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <YoutubeLogo size={40} />
          <h3>还没有创作者</h3>
          <p>添加后，明确对应比赛的前瞻与复盘会以原视频链接补充到日历中。</p>
        </div>
      )}
      <section className="review-section" aria-label="待确认视频">
        <div className="section-toolbar">
          <div>
            <h2>待确认</h2>
            <p>对应关系不够明确时，由你决定是否附到这场比赛。</p>
          </div>
          <span className="count-label">{reviews.length} 项</span>
        </div>
        {reviewError ? (
          <p role="alert" className="creator-sync-error">
            {reviewError}
          </p>
        ) : loading ? (
          <p>正在加载…</p>
        ) : reviews.length ? (
          <>
            <div className="review-toolbar">
              <label>
                <span className="sr-only">搜索待确认视频</span>
                <input
                  type="search"
                  placeholder="搜索视频、创作者或比赛"
                  value={reviewSearch}
                  onChange={(event) => setReviewSearch(event.target.value)}
                />
              </label>
              <select
                aria-label="筛选创作者"
                value={reviewCreator}
                onChange={(event) => setReviewCreator(event.target.value)}
              >
                <option value="">全部创作者</option>
                {creators.map((creator) => (
                  <option key={creator}>{creator}</option>
                ))}
              </select>
              <select
                aria-label="待确认排序"
                value={reviewSort}
                onChange={(event) =>
                  setReviewSort(event.target.value as typeof reviewSort)
                }
              >
                <option value="oldest">最早发布优先</option>
                <option value="newest">最新发布优先</option>
                <option value="event">比赛时间优先</option>
              </select>
              <label className="review-group-toggle">
                <input
                  type="checkbox"
                  checked={groupReviews}
                  onChange={(event) => setGroupReviews(event.target.checked)}
                />
                按比赛分组
              </label>
            </div>
            <div className="review-batchbar">
              <label>
                <input
                  type="checkbox"
                  checked={
                    pagedReviews.length > 0 &&
                    pagedReviews.every((review) =>
                      selectedReviews.has(review.id),
                    )
                  }
                  onChange={(event) =>
                    setSelectedReviews((current) => {
                      const next = new Set(current);
                      pagedReviews.forEach((review) =>
                        event.target.checked
                          ? next.add(review.id)
                          : next.delete(review.id),
                      );
                      return next;
                    })
                  }
                />
                选择本页
              </label>
              <span>{selectedReviews.size} 项已选</span>
              <button
                className="secondary-button"
                disabled={!selectedReviews.size || busy}
                onClick={() => void decideMany("ignore")}
              >
                批量不关联
              </button>
              <button
                className="primary-button"
                disabled={!selectedReviews.size || busy}
                onClick={() => void decideMany("confirm")}
              >
                <Check size={15} />
                批量确认关联
              </button>
            </div>
            {reviewGroups.map((group) => (
              <section className="review-group" key={group.key}>
                {group.label && (
                  <h3 className="review-group-title">
                    {group.label}
                    <small>{group.items.length} 项</small>
                  </h3>
                )}
                <div className="review-list">
                  {group.items.map((review) => (
                    <ReviewCard
                      key={review.id + review.updated_at}
                      review={review}
                      spoilerFree={
                        user?.config.preferences.spoiler_free ?? true
                      }
                      busy={busy}
                      selected={selectedReviews.has(review.id)}
                      onSelected={(selected) =>
                        toggleReview(review.id, selected)
                      }
                      kind={reviewKinds[review.id] || "preview"}
                      onKind={(kind) =>
                        setReviewKinds((current) => ({
                          ...current,
                          [review.id]: kind,
                        }))
                      }
                      onDecide={(decision, kind) =>
                        run(
                          () =>
                            write(`/me/reviews/${review.id}`, "POST", {
                              decision,
                              kind,
                              expected_updated_at: review.updated_at,
                            }),
                          () =>
                            setReviews((current) =>
                              current.filter((r) => r.id !== review.id),
                            ),
                        )
                      }
                    />
                  ))}
                </div>
              </section>
            ))}
            {!visibleReviews.length && (
              <div className="review-empty">没有符合筛选条件的待确认视频。</div>
            )}
            {visibleReviews.length > REVIEW_PAGE_SIZE && (
              <nav className="review-pagination" aria-label="待确认分页">
                <button
                  className="secondary-button"
                  disabled={reviewPage === 1}
                  onClick={() => setReviewPage((page) => page - 1)}
                >
                  上一页
                </button>
                <span>
                  第 {reviewPage} / {reviewPageCount} 页 · 共{" "}
                  {visibleReviews.length} 项
                </span>
                <button
                  className="secondary-button"
                  disabled={reviewPage === reviewPageCount}
                  onClick={() => setReviewPage((page) => page + 1)}
                >
                  下一页
                </button>
              </nav>
            )}
          </>
        ) : (
          <div className="review-empty">
            {user?.creators.length
              ? "当前没有待确认的视频。频道更新后，新候选会出现在这里。"
              : "关注创作者并收到视频后，需你确认的关联会出现在这里。"}
          </div>
        )}
      </section>
      <div className="info-note">
        <YoutubeLogo size={18} />
        <span>
          仅附加原视频链接。移除的视频不会被自动加回；固定的链接会随比赛保留。
        </span>
      </div>
    </div>
  );
}

function ReviewCard({
  review,
  spoilerFree,
  busy,
  selected,
  onSelected,
  kind,
  onKind,
  onDecide,
}: {
  review: Review;
  spoilerFree: boolean;
  busy: boolean;
  selected: boolean;
  onSelected: (selected: boolean) => void;
  kind: "preview" | "recap";
  onKind: (kind: "preview" | "recap") => void;
  onDecide: (decision: "confirm" | "ignore", kind: "preview" | "recap") => void;
}) {
  return (
    <article className="review-card">
      <div className="review-source">
        <label className="review-select">
          <input
            type="checkbox"
            checked={selected}
            onChange={(event) => onSelected(event.target.checked)}
          />
          <span className="sr-only">选择 {review.title}</span>
        </label>
        <YoutubeLogo size={16} />
        {review.creator}
        <span>视频候选</span>
      </div>
      {spoilerFree && review.kind !== "preview" ? (
        <details>
          <summary>显示视频标题（可能含赛果）</summary>
          <h3>{review.title}</h3>
        </details>
      ) : (
        <h3>{review.title}</h3>
      )}
      <a
        className="review-original"
        href={review.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        打开原视频 <ArrowUpRight size={14} />
      </a>
      <Link
        className="review-event"
        href={`/calendar?event=${review.event_id}`}
      >
        <span>拟关联比赛</span>
        <b>{review.event_title}</b>
        <small>
          {review.starts_at
            ? new Date(review.starts_at).toLocaleString("zh-CN")
            : "时间待定"}
        </small>
      </Link>
      <p className="review-reasons">
        {review.reason_codes
          .map((reason) => labels[reason] || "信息仍需确认")
          .join(" · ")}
      </p>
      <div className="creator-actions">
        <select
          aria-label={`关联类型 ${review.id}`}
          value={kind}
          onChange={(e) => onKind(e.target.value as "preview" | "recap")}
        >
          <option value="preview">赛前前瞻</option>
          <option value="recap">赛后复盘</option>
        </select>
        <button
          className="secondary-button"
          disabled={busy}
          onClick={() => onDecide("ignore", kind)}
        >
          不关联此场
        </button>
        <button
          className="primary-button"
          disabled={busy}
          onClick={() => onDecide("confirm", kind)}
        >
          <Check size={15} />
          确认关联
        </button>
      </div>
    </article>
  );
}
