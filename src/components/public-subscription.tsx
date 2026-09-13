"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Copy, DownloadSimple, ArrowClockwise } from "@phosphor-icons/react";
import { api, ApiError } from "@/lib/api";
import type { PublicFeed, Source } from "@/lib/types";

export function PublicSubscription({
  sources,
  flash,
}: {
  sources: Source[];
  flash: (message: string) => void;
}) {
  const [selected, setSelected] = useState("");
  const [feed, setFeed] = useState<PublicFeed | null>(null);
  const [error, setError] = useState("");
  const [available, setAvailable] = useState<boolean | null>(null);
  const [retry, setRetry] = useState(0);
  const sourceId = sources.some((s) => s.id === selected)
    ? selected
    : sources[0]?.id || "";
  useEffect(() => {
    setFeed(null);
    setError("");
    if (!sourceId) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      try {
        const next = await api<PublicFeed>(
          `/public-feed?source_key=${encodeURIComponent(sourceId)}`,
          {
            signal: controller.signal,
          },
        );
        if (controller.signal.aborted) return;
        setAvailable(true);
        setFeed(next);
        if (next.status === "pending" || next.status === "updating")
          timer = setTimeout(load, 2000);
      } catch (e) {
        if (controller.signal.aborted) return;
        if (e instanceof ApiError && e.code === "DOCUMENT_FEATURE_UNAVAILABLE")
          setAvailable(false);
        else setError(e instanceof Error ? e.message : "公共日历暂时无法读取");
      }
    };
    void load();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [sourceId, retry]);
  // Hide the previous source's address immediately when selection changes.
  const current = feed?.source_id === sourceId ? feed : null;
  const copy = async () => {
    if (!current?.url) return;
    try {
      await navigator.clipboard.writeText(current.url);
      flash(
        current.local_only
          ? "已复制公共订阅地址。当前仅供本机测试，手机订阅需公开 HTTPS 地址。"
          : "已复制公共订阅地址，请在日历中通过网址添加",
      );
    } catch {
      setError("未能复制，请选中下方地址手动复制");
    }
  };
  if (available === false)
    return (
      <section
        className="public-subscription"
        aria-labelledby="public-subscription-title"
      >
        <div className="public-subscription-heading">
          <div>
            <h2 id="public-subscription-title">公共日历尚未开放</h2>
            <p>
              当前环境可使用下方的个人日历。登录并保存关注后，即可获取个人订阅地址。
            </p>
          </div>
        </div>
      </section>
    );
  if (sourceId && available === null)
    return (
      <section className="public-subscription" aria-live="polite">
        <div className="public-subscription-heading">
          <div>
            <span className="eyebrow">无需登录</span>
            <h2>正在检查公共日历</h2>
            <p>确认当前环境可用后，再显示可订阅的球队与赛事。</p>
          </div>
          <span className="loader" aria-hidden="true" />
        </div>
      </section>
    );
  return (
    <section
      className="public-subscription"
      aria-labelledby="public-subscription-title"
    >
      <div className="public-subscription-heading">
        <div>
          <span className="eyebrow">无需登录</span>
          <h2 id="public-subscription-title">先订阅一支球队或赛事</h2>
          <p>
            公共日历包含赛程与已审核的直播入口。关注创作者或组合多个球队，请使用个人日历。
          </p>
        </div>
        <label>
          公共日历
          <select
            aria-label="选择公共球队或赛事"
            value={sourceId}
            onChange={(e) => setSelected(e.target.value)}
            disabled={!sources.length}
          >
            {!sources.length && <option value="">暂无可选赛程</option>}
            {sources.map((s) => (
              <option value={s.id} key={s.id}>
                {s.demo ? "演示 · " : ""}
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div aria-live="polite" className="public-feed-state">
        {error ? (
          <p role="alert">{error}</p>
        ) : !sourceId ? (
          <p>此数据集尚无球队或赛事，请选择其他赛程数据。</p>
        ) : !current ? (
          <p>正在读取公共日历…</p>
        ) : (
          <p>
            {current.demo && "演示赛程 · "}
            {current.status === "unavailable"
              ? "此来源尚未开放公共订阅。"
              : current.status === "error"
                ? "更新失败，保留最后已发布内容。"
                : current.status === "pending" || current.status === "updating"
                  ? "公共订阅源更新中。"
                  : `${current.event_count} 场比赛 · 订阅源已发布`}
            {current.updated_at &&
              ` · ${new Date(current.updated_at).toLocaleString("zh-CN")}`}
          </p>
        )}
      </div>
      {current?.url && (
        <>
          <label className="public-feed-url">
            公共订阅地址
            <input
              aria-label="公共订阅地址"
              readOnly
              value={current.url}
              onFocus={(e) => e.currentTarget.select()}
            />
          </label>
          <div className="public-feed-actions">
            <button className="primary-button" onClick={copy}>
              <Copy size={16} />
              复制公共订阅地址
            </button>
            <a
              className="secondary-button"
              href={current.url}
              download="anke-sports-public.ics"
            >
              <DownloadSimple size={16} />
              下载一次性 ICS
            </a>
            <p>
              {current.local_only
                ? "本地地址仅供本机测试。"
                : "复制地址用于持续订阅。"}
              下载文件不会持续更新。
            </p>
          </div>
        </>
      )}
      {(error || current?.status === "error") && (
        <button className="text-button" onClick={() => setRetry((x) => x + 1)}>
          <ArrowClockwise size={16} />
          重新检查发布状态
        </button>
      )}
      <p className="subscription-migration">
        已订阅公共日历，准备改用个人日历？先
        <Link href="/following">保存相同球队的关注</Link>
        ，再添加个人订阅，并在系统日历中移除旧公共订阅。多个公共日历之间也可能有重复比赛；Anke
        Sports 无法替你删除外部订阅。
      </p>
    </section>
  );
}
