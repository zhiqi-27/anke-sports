"use client";
import { useEffect, useState } from "react";
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
type Props = {
  user: CalendarUser | null;
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
          setReviews(data.items);
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
    const timer = setInterval(load, 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [user?.id, epoch]);
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
          <p>比赛日历里，也有你关注的声音。</p>
        </div>
        <span className="count-label">
          {user?.creators.length || 0} 位创作者
        </span>
      </div>
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
                        ? "正在检查频道更新…"
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
          <h3>比赛之外，听听他们怎么说。</h3>
          <p>
            添加创作者后，明确对应比赛的前瞻与复盘会以原视频链接补充到日历中。
          </p>
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
          <div className="review-list">
            {reviews.map((review) => (
              <ReviewCard
                key={review.id + review.updated_at}
                review={review}
                spoilerFree={user?.config.preferences.spoiler_free ?? true}
                busy={busy}
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
  onDecide,
}: {
  review: Review;
  spoilerFree: boolean;
  busy: boolean;
  onDecide: (decision: "confirm" | "ignore", kind: "preview" | "recap") => void;
}) {
  const [kind, setKind] = useState<"preview" | "recap">(
    review.kind === "recap" ? "recap" : "preview",
  );
  return (
    <article className="review-card">
      <div className="review-source">
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
          onChange={(e) => setKind(e.target.value as "preview" | "recap")}
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
