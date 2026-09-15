"use client";

import { useEffect, useRef, useState } from "react";
import { X, ArrowClockwise, Check } from "@phosphor-icons/react";
import { api, ApiError } from "@/lib/api";
import type { CalendarUser, Follow, FollowPreviewView } from "@/lib/types";

export function FollowPreview({
  follows,
  revision,
  timezone,
  onClose,
  onSaved,
  onSaving,
}: {
  follows: Follow[];
  revision: number;
  timezone: string;
  onClose: () => void;
  onSaved: () => void;
  onSaving: (value: boolean) => void;
}) {
  const [preview, setPreview] = useState<FollowPreviewView | null>(null);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState("");
  const [notice, setNotice] = useState("");
  const [effectiveRevision, setEffectiveRevision] = useState(revision);
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const commandKey = useRef("");
  const submitting = useRef(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const automaticRebases = useRef(0);

  const rebase = async (automatic = false) => {
    if (automatic && automaticRebases.current >= 2) return false;
    if (automatic) automaticRebases.current += 1;
    try {
      const latest = await api<CalendarUser>("/me/calendar");
      setPreview(null);
      setConflict("");
      setError("");
      setNotice("关注已在其他页面更新。你的选择已保留，并按最新版本重新计算。");
      if (latest.revision === effectiveRevision) setRetry((value) => value + 1);
      else setEffectiveRevision(latest.revision);
      return true;
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "无法读取最新关注，请重试",
      );
      return false;
    }
  };

  useEffect(() => {
    if (error) errorRef.current?.focus();
    else if (preview) headingRef.current?.focus();
  }, [error, preview]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setPreview(null);
    setError("");
    setConflict("");
    api<FollowPreviewView>("/me/follows/preview", {
      method: "POST",
      body: JSON.stringify({ expected_revision: effectiveRevision, follows }),
      signal: controller.signal,
    })
      .then((value) => {
        if (controller.signal.aborted) return;
        commandKey.current = crypto.randomUUID();
        setPreview(value);
      })
      .catch(async (e) => {
        if (controller.signal.aborted) return;
        if (
          e instanceof ApiError &&
          e.status === 409 &&
          e.code === "REVISION_CONFLICT" &&
          (await rebase(true))
        )
          return;
        setError(e instanceof Error ? e.message : "暂时无法预览，请重试");
        if (e instanceof ApiError) setConflict(e.code);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [effectiveRevision, follows, retry]);

  const save = async () => {
    if (!preview || submitting.current || conflict) return;
    submitting.current = true;
    setSaving(true);
    onSaving(true);
    setError("");
    try {
      await api<CalendarUser>("/me/follows", {
        method: "PUT",
        headers: { "Idempotency-Key": commandKey.current },
        body: JSON.stringify({
          expected_revision: preview.revision,
          follows,
          confirmation: preview.confirmation,
        }),
      });
      onSaved();
    } catch (e) {
      if (
        e instanceof ApiError &&
        e.status === 409 &&
        e.code === "REVISION_CONFLICT" &&
        (await rebase(true))
      )
        return;
      setError(e instanceof Error ? e.message : "保存结果尚未确认，请重试");
      if (e instanceof ApiError && e.status === 409) setConflict(e.code);
      // Keep the same command key after an uncertain network result.
    } finally {
      submitting.current = false;
      setSaving(false);
      onSaving(false);
    }
  };

  return (
    <div className="follow-preview" aria-busy={loading || saving}>
      <button
        className="dialog-close"
        aria-label="关闭关注预览"
        onClick={onClose}
        disabled={saving}
      >
        <X size={20} />
      </button>
      <span className="eyebrow">保存之前</span>
      <h2 ref={headingRef} tabIndex={-1}>
        这次关注会改变什么
      </h2>
      {loading && <p role="status">正在计算日历变化…</p>}
      {notice && (
        <p className="follow-preview-notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p
          ref={errorRef}
          tabIndex={-1}
          className="follow-preview-error"
          role="alert"
        >
          {error}
        </p>
      )}
      {preview && (
        <>
          <div className="follow-source-changes">
            {(["added_sources", "removed_sources"] as const).map(
              (key) =>
                preview[key].length > 0 && (
                  <p key={key}>
                    <strong>
                      {key === "added_sources" ? "新增关注" : "取消关注"}
                    </strong>
                    {preview[key]
                      .map(
                        (source) =>
                          `${source.demo ? "演示 · " : ""}${source.name}`,
                      )
                      .join("、")}
                  </p>
                ),
            )}
            {preview.removed_creators.length > 0 && (
              <p>
                <strong>同步取消创作者</strong>
                {preview.removed_creators
                  .map((creator) => creator.name)
                  .join("、")}
              </p>
            )}
          </div>
          <div className="follow-impact-counts">
            <div>
              <b>{preview.added.total}</b>
              <span>新增比赛</span>
            </div>
            <div>
              <b>{preview.removed.future}</b>
              <span>移除未来比赛</span>
            </div>
            <div>
              <b>{preview.retained.total}</b>
              <span>其他选择保留</span>
            </div>
          </div>
          <p className="follow-impact-context">
            变更后日历包含 <strong>{preview.result_count} 场</strong>比赛。
            {preview.historical_retained > 0 &&
              `其中 ${preview.historical_retained} 场历史比赛继续保留，可追加复盘。`}
            {preview.undated_count > 0 &&
              `另有 ${preview.undated_count} 场尚无日期，确定日期后再加入。`}
          </p>
          {(["added", "removed", "retained"] as const).map((key) => {
            const group = preview[key];
            if (!group.total) return null;
            const label = {
              added: "新增比赛",
              removed: "移除比赛",
              retained: "由其他关注或单场选择保留",
            }[key];
            return (
              <details
                className="follow-impact-list"
                key={key}
                open={key === "removed" || undefined}
              >
                <summary>
                  {label} · {group.total} 场
                  {group.past > 0 && `（含 ${group.past} 场历史比赛）`}
                </summary>
                <ul>
                  {group.items.map((event) => (
                    <li key={event.id}>
                      <span>
                        {event.demo ? "演示 · " : ""}
                        {event.title}
                      </span>
                      <small>
                        {event.time_precision === "exact" && event.starts_at
                          ? new Intl.DateTimeFormat("zh-CN", {
                              timeZone: timezone,
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }).format(new Date(event.starts_at))
                          : `${event.local_date || "日期待定"} · 时间待定`}
                      </small>
                    </li>
                  ))}
                </ul>
                {group.total > group.items.length && (
                  <small>
                    仅展示前 {group.items.length} 场，数量已包含全部比赛。
                  </small>
                )}
              </details>
            );
          })}
          {preview.feed_paused && (
            <p className="follow-preview-notice">
              订阅已暂停。关注会保存，恢复订阅后才发布这些变化。
            </p>
          )}
          {preview.publication_pending && (
            <p className="follow-preview-notice">
              上次订阅更新仍在处理中，此处与最近已发布的内容比较。
            </p>
          )}
          <small className="modal-note">
            范围：{preview.window_start} 至 {preview.window_end}，时间按{" "}
            {timezone}{" "}
            显示。数量基于当前已接入赛程，保存后由后台更新订阅源；手机日历显示时间由客户端决定。
          </small>
        </>
      )}
      <div className="modal-actions">
        <button
          className="secondary-button"
          onClick={onClose}
          disabled={saving}
        >
          返回修改
        </button>
        {!loading &&
          (conflict === "REVISION_CONFLICT" ? (
            <button className="primary-button" onClick={() => void rebase()}>
              保留选择并重新计算
            </button>
          ) : conflict || !preview ? (
            <button
              className="primary-button"
              onClick={() => setRetry((n) => n + 1)}
            >
              <ArrowClockwise size={16} />
              重新预览
            </button>
          ) : (
            <button
              className="primary-button"
              disabled={saving}
              onClick={() => void save()}
            >
              <Check size={16} />
              {saving ? "正在保存…" : error ? "重试保存" : "确认保存"}
            </button>
          ))}
      </div>
    </div>
  );
}
