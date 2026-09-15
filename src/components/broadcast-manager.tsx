"use client";
import { useCallback, useEffect, useState } from "react";
import type { components } from "@/lib/generated";
import type { CalendarUser, SportEvent } from "@/lib/types";
import { api } from "@/lib/api";

type RecordView = components["schemas"]["BroadcastView"];
type Draft = components["schemas"]["BroadcastDraft"];
type Observation = components["schemas"]["DeviceEvidence"];
type Platform = {
  id: string;
  name: string;
  evidence: string;
  mobile_opening: "verified_https_app_link" | "web_handoff";
  rights: Array<{
    competition_id: string;
    regions: string[];
    valid_through: string | null;
    evidence: string;
  }>;
};
const contentLabels = {
  official_match: "比赛直播",
  reservation: "直播预约",
  programme: "官方播出信息",
  watch_along: "同步解说，无比赛画面",
  replay: "官方完整回放",
};
const accessLabels = {
  unknown: "观看条件未验证",
  free: "免费",
  login: "需要登录",
  subscription: "需要订阅",
  pay_per_view: "单次付费",
};
const statusLabels: Record<string, string> = {
  draft: "未发布",
  published: "已发布",
  suspended: "已撤回",
  expired: "核验到期",
  unavailable: "链接已失效",
  needs_review: "需要重新核验",
};
const networkLabels: Record<string, string> = {
  not_checked: "尚未检查",
  reachable: "网页可达",
  not_found: "页面未找到，待复查",
  restricted: "页面访问受限",
  retry: "网络检查未完成",
  head_unsupported: "平台不支持此检查",
  unsafe: "安全检查未通过",
  redirect_review: "跳转目标需要人工核对",
};
const emptyDraft = (): Draft => ({
  event_id: "",
  url: "",
  title: "",
  content_type: "official_match",
  access: "unknown",
  region_mode: "unknown",
  regions: [],
  evidence_url: "",
  evidence_note: "",
});
const when = (value: string) =>
  new Date(value).toLocaleString("zh-CN", { hour12: false });

export function BroadcastManager({
  user,
  dataset,
}: {
  user: CalendarUser | null;
  dataset: string;
}) {
  const [items, setItems] = useState<RecordView[]>([]),
    [current, setCurrent] = useState<RecordView | null>(null);
  const [fields, setFields] = useState<Draft>(emptyDraft),
    [events, setEvents] = useState<SportEvent[]>([]);
  const [query, setQuery] = useState(""),
    [date, setDate] = useState(""),
    [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false),
    [hours, setHours] = useState("24"),
    [reason, setReason] = useState("");
  const [filterEvent, setFilterEvent] = useState("");
  const [regionsText, setRegionsText] = useState("");
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const choose = useCallback((record: RecordView | null) => {
    setCurrent(record);
    setFields(record?.draft || emptyDraft());
    setRegionsText(record?.draft.regions?.join(", ") || "");
    setConfirmed(false);
    setReason("");
  }, []);
  const reload = useCallback(async () => {
    const result = await api<components["schemas"]["BroadcastList"]>(
      `/maintenance/broadcasts?limit=50${filterEvent ? `&event_id=${encodeURIComponent(filterEvent)}` : ""}`,
    );
    setItems(result.items);
    setHasMore(result.has_more);
  }, [filterEvent]);
  useEffect(() => {
    if (user?.is_maintainer) {
      void reload().catch((e) => setError(e.message));
      void api<{ items: Platform[] }>("/platforms")
        .then((result) => setPlatforms(result.items))
        .catch((e) => setError(e.message));
    }
  }, [user?.is_maintainer, reload]);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作未完成");
    } finally {
      setBusy(false);
    }
  }
  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setFields((old) => ({ ...old, [key]: value }));
    setConfirmed(false);
  }
  async function mutate(suffix: string, data: unknown, success: string) {
    const next = await api<RecordView>(
      `/maintenance/broadcasts/${current!.id}/${suffix}`,
      { method: "POST", body: JSON.stringify(data) },
    );
    choose(next);
    await reload();
    setMessage(success);
  }
  if (!user?.is_maintainer)
    return (
      <div className="management-page">
        <div className="broadcast-empty">
          公共直播入口由维护者审核。请使用已配置的维护者账号登录；个人链接仍可在比赛抽屉中添加。
        </div>
      </div>
    );
  const dirty = JSON.stringify(fields) !== JSON.stringify(current?.draft);
  const selectedEvent = events.find((e) => e.id === fields.event_id);
  const selectedRegions = fields.regions || [];
  const recommendedPlatforms = platforms.filter((platform) => {
    const covered = new Set(
      platform.rights
        .filter(
          (right) => right.competition_id === selectedEvent?.competition_id,
        )
        .flatMap((right) => right.regions),
    );
    return (
      selectedRegions.length > 0 &&
      selectedRegions.every((region) => covered.has(region))
    );
  });
  return (
    <div className="management-page broadcast-manager">
      <p className="broadcast-intro">
        公共入口先保存草稿，再核对来源与具体场次。比赛直播、预约、播出信息和同步解说分别标注。
      </p>
      {error && (
        <p role="alert" className="broadcast-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="broadcast-success">
          {message}
        </p>
      )}
      <div className="broadcast-grid">
        <section className="broadcast-records" aria-label="直播审核记录">
          <div className="broadcast-toolbar">
            <h2>审核记录</h2>
            <button
              disabled={busy}
              onClick={() => {
                choose(null);
                setMessage("");
              }}
            >
              新建
            </button>
            <button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await reload();
                  if (current)
                    choose(
                      await api<RecordView>(
                        `/maintenance/broadcasts/${current.id}`,
                      ),
                    );
                })
              }
            >
              刷新
            </button>
          </div>
          <label>
            按比赛ID查记录
            <input
              aria-label="按比赛ID查记录"
              value={filterEvent}
              onChange={(e) => setFilterEvent(e.target.value)}
              placeholder="留空显示近期记录"
            />
          </label>
          {hasMore && <p>仅显示近期50条，请按比赛ID缩小范围。</p>}
          <div className="broadcast-record-list">
            {items.map((item) => (
              <button
                key={item.id}
                className={current?.id === item.id ? "selected" : ""}
                onClick={() => choose(item)}
                disabled={busy}
              >
                <strong>{item.event_title}</strong>
                <span>
                  {item.event_demo ? "演示 · " : ""}
                  {statusLabels[item.status]} · {item.draft.title}
                </span>
                <small>
                  版本 {item.revision}
                  {item.draft_changed ? " · 请核对当前草稿" : ""}
                </small>
              </button>
            ))}
          </div>
          {!items.length && (
            <p className="broadcast-empty">还没有匹配的审核记录。</p>
          )}
        </section>
        <section className="broadcast-editor" aria-label="编辑公共直播入口">
          <h2>{current ? "编辑与核验" : "新建公共入口"}</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const result = await api<RecordView>(
                  `/maintenance/broadcasts${current ? `/${current.id}` : ""}`,
                  {
                    method: current ? "PUT" : "POST",
                    body: JSON.stringify({
                      ...fields,
                      ...(current
                        ? { expected_revision: current.revision }
                        : {}),
                    }),
                  },
                );
                choose(result);
                await reload();
                setMessage("草稿已保存，尚未发布这些修改。");
              });
            }}
          >
            <fieldset disabled={busy}>
              {!current && (
                <div className="broadcast-search">
                  <label>
                    查找具体比赛
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="球队或赛事名称"
                      maxLength={200}
                    />
                  </label>
                  <div className="broadcast-inline">
                    <label>
                      日期附近
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        void run(async () => {
                          const anchor = date
                            ? Date.parse(date + "T00:00:00Z")
                            : Date.now();
                          const from = new Date(
                              anchor - (date ? 1 : 90) * 86400000,
                            ),
                            to = new Date(anchor + (date ? 2 : 90) * 86400000);
                          const params = new URLSearchParams({
                            from: from.toISOString(),
                            to: to.toISOString(),
                            dataset,
                            q: query,
                            limit: "100",
                          });
                          const result = await api<
                            components["schemas"]["EventList"]
                          >("/events?" + params);
                          setEvents(result.items);
                          if (result.next_cursor)
                            setMessage(
                              "比赛较多，仅显示前100场，请用日期或名称缩小范围。",
                            );
                          else if (!result.items.length)
                            setMessage("没有找到比赛。");
                        })
                      }
                    >
                      查找比赛
                    </button>
                  </div>
                  <label>
                    选择比赛
                    <select
                      required
                      value={fields.event_id}
                      onChange={(e) => update("event_id", e.target.value)}
                    >
                      <option value="">请选择具体比赛</option>
                      {events.map((event) => (
                        <option key={event.id} value={event.id}>
                          {event.demo ? "演示 · " : ""}
                          {event.title} ·{" "}
                          {event.starts_at
                            ? when(event.starts_at)
                            : event.local_date || "时间待定"}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
              <div className="broadcast-event">
                <strong>
                  {current?.event_title ||
                    selectedEvent?.title ||
                    "请先选择比赛"}
                </strong>
                {(current?.event_demo || selectedEvent?.demo) && (
                  <span>演示比赛 · 不代表真实官方入口</span>
                )}
                <small>{fields.event_id}</small>
              </div>
              <label>
                入口标题
                <input
                  required
                  value={fields.title}
                  onChange={(e) => update("title", e.target.value)}
                  maxLength={300}
                />
              </label>
              <label>
                平台原链接
                <input
                  required
                  type="url"
                  value={fields.url}
                  onChange={(e) => update("url", e.target.value)}
                  placeholder="具体内容的 HTTPS 网页地址"
                  maxLength={2000}
                />
              </label>
              {!!selectedEvent && (
                <details>
                  <summary>查看该赛事与地区的已核验版权方</summary>
                  {!selectedRegions.length ? (
                    <p>请先在下方选择“仅限指定地区”并填写国家代码。</p>
                  ) : recommendedPlatforms.length ? (
                    recommendedPlatforms.map((platform) => {
                      const right = platform.rights.find(
                        (item) =>
                          item.competition_id ===
                            selectedEvent.competition_id &&
                          selectedRegions.some((region) =>
                            item.regions.includes(region),
                          ),
                      );
                      return (
                        <p key={platform.id}>
                          <button
                            type="button"
                            onClick={() => {
                              update("evidence_url", right!.evidence);
                            }}
                          >
                            {platform.name}
                          </button>{" "}
                          · {selectedRegions.join(", ")} ·{" "}
                          {platform.mobile_opening === "verified_https_app_link"
                            ? "支持官方 HTTPS App Link"
                            : "网页交接，App 直达未验证"}
                          {right!.valid_through
                            ? ` · 权利期至 ${right!.valid_through}`
                            : " · 发布前复核当前权利"}
                        </p>
                      );
                    })
                  ) : (
                    <p>该地区尚无已核验版权方，请不要发布为比赛直播。</p>
                  )}
                </details>
              )}
              <div className="broadcast-field-grid">
                <label>
                  内容类型
                  <select
                    value={fields.content_type}
                    onChange={(e) =>
                      update(
                        "content_type",
                        e.target.value as Draft["content_type"],
                      )
                    }
                  >
                    {Object.entries(contentLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  观看条件
                  <select
                    value={fields.access}
                    onChange={(e) =>
                      update("access", e.target.value as Draft["access"])
                    }
                  >
                    {Object.entries(accessLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="broadcast-field-grid">
                <label>
                  地区规则
                  <select
                    value={fields.region_mode}
                    onChange={(e) => {
                      const mode = e.target.value as Draft["region_mode"];
                      setFields({
                        ...fields,
                        region_mode: mode,
                        regions: ["include", "exclude"].includes(mode || "")
                          ? fields.regions
                          : [],
                      });
                      if (!["include", "exclude"].includes(mode || ""))
                        setRegionsText("");
                      setConfirmed(false);
                    }}
                  >
                    <option value="unknown">未验证</option>
                    <option value="global">来源声明全球可用</option>
                    <option value="include">仅限指定地区</option>
                    <option value="exclude">排除指定地区</option>
                  </select>
                </label>
                <label>
                  地区代码
                  <input
                    disabled={
                      !["include", "exclude"].includes(fields.region_mode || "")
                    }
                    value={regionsText}
                    onChange={(e) => {
                      setRegionsText(e.target.value);
                      update(
                        "regions",
                        e.target.value
                          .split(/[,，\s]+/)
                          .filter(Boolean)
                          .map((x) => x.toUpperCase()),
                      );
                    }}
                    placeholder="US, GB"
                  />
                </label>
              </div>
              <label>
                官方来源证据页
                <input
                  required
                  type="url"
                  value={fields.evidence_url}
                  onChange={(e) => update("evidence_url", e.target.value)}
                  placeholder="能核对本场内容与观看条件的官方页面"
                  maxLength={2000}
                />
              </label>
              <label>
                核对依据
                <textarea
                  required
                  rows={3}
                  minLength={10}
                  maxLength={1500}
                  value={fields.evidence_note}
                  onChange={(e) => update("evidence_note", e.target.value)}
                  placeholder="说明如何确认来源、比赛身份、画面类型与地区/付费条件"
                />
              </label>
              <button
                className="primary-button"
                type="submit"
                disabled={!!current && !dirty}
              >
                保存待审核草稿
              </button>
            </fieldset>
          </form>
          {current && (
            <>
              <section className="broadcast-publish">
                <h3>核对并发布</h3>
                <p>
                  发布后，入口对所有适用用户可见，并更新已关注用户的原比赛事件。当前状态：
                  {statusLabels[current.status]}。
                </p>
                {current.published && (
                  <p>
                    已发布版本：{current.published_revision} ·{" "}
                    {String(current.published.title)}；核验到期：
                    {when(String(current.published.valid_until))}。
                  </p>
                )}
                <label className="broadcast-check">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    disabled={busy || dirty}
                    onChange={(e) => setConfirmed(e.target.checked)}
                  />
                  已核对官方来源、具体场次与上述观看条件
                </label>
                <div className="broadcast-inline">
                  <label>
                    复查期限
                    <select
                      value={hours}
                      onChange={(e) => setHours(e.target.value)}
                    >
                      <option value="1">1小时后</option>
                      <option value="6">6小时后</option>
                      <option value="24">24小时后</option>
                      <option value="72">3天后</option>
                      <option value="168">7天后</option>
                    </select>
                  </label>
                  <button
                    disabled={busy || dirty || !confirmed}
                    onClick={() =>
                      void run(() =>
                        mutate(
                          "publish",
                          {
                            expected_revision: current.revision,
                            source_and_event_confirmed: confirmed,
                            valid_until: new Date(
                              Date.now() + Number(hours) * 3600000,
                            ).toISOString(),
                          },
                          "已审核发布，后台会更新相关订阅源。",
                        ),
                      )
                    }
                  >
                    审核并发布
                  </button>
                </div>
                {dirty && <p>先保存草稿，再确认本次发布。</p>}
              </section>
              <section className="broadcast-maintain">
                <h3>可达性与撤回</h3>
                <p>
                  {networkLabels[current.network_status] ||
                    current.network_status}
                  {current.network_checked_at
                    ? ` · ${when(current.network_checked_at)}`
                    : ""}
                  。网页可达不代表App直达或账号能够播放。
                </p>
                <button
                  disabled={busy || current.status !== "published"}
                  onClick={() =>
                    void run(() =>
                      mutate(
                        "check",
                        {
                          expected_revision: current.revision,
                          reason: "维护者请求网页可达性检查",
                        },
                        "可达性检查已入队，可稍后刷新读取结果。",
                      ),
                    )
                  }
                >
                  检查已发布链接
                </button>
                <label>
                  撤回原因
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={500}
                    placeholder="例如入口已对应其他比赛"
                  />
                </label>
                <button
                  disabled={
                    busy ||
                    current.status !== "published" ||
                    reason.trim().length < 3
                  }
                  onClick={() =>
                    void run(() =>
                      mutate(
                        "suspend",
                        { expected_revision: current.revision, reason },
                        "公共入口已撤回，比赛事件身份保持不变。",
                      ),
                    )
                  }
                >
                  撤回公共入口
                </button>
              </section>
              <DeviceForm
                current={current}
                busy={busy}
                submit={(data) =>
                  run(() =>
                    mutate(
                      "device-evidence",
                      data,
                      "设备观察已记录，仅适用于所填组合。",
                    ),
                  )
                }
              />
              <details className="broadcast-audit">
                <summary>核验与操作记录（最近30条）</summary>
                {current.audit.map((item, index) => (
                  <p key={index}>
                    {when(String(item.created_at))} · {String(item.action)} ·
                    版本{String(item.revision)}
                  </p>
                ))}
              </details>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function DeviceForm({
  current,
  busy,
  submit,
}: {
  current: RecordView;
  busy: boolean;
  submit: (data: Observation) => Promise<void>;
}) {
  const [dateError, setDateError] = useState("");
  const [values, setValues] = useState({
    platform_app: "",
    os_version: "",
    calendar_client: "",
    region: "",
    conditions: "",
    evidence_ref: "",
    checked_at: "",
    app_installed: false,
    exact_content: "not_tested",
    app_content: "not_tested",
    playback: "not_tested",
  });
  const update = (key: string, value: string | boolean) =>
    setValues((old) => ({ ...old, [key]: value }));
  return (
    <details className="broadcast-device">
      <summary>记录实际设备观察（{current.device_tests.length}条）</summary>
      <p>
        只填写已实际观察的结果。L1为内容正确，L2为进入App内该内容，L3为在所填条件下可播放。
      </p>
      {current.device_tests.map((test, i) => (
        <p key={i}>
          {String(test.os_version)} · {String(test.calendar_client)} · L1{" "}
          {String(test.exact_content)} / L2 {String(test.app_content)} / L3{" "}
          {String(test.playback)}
        </p>
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          const observedAt = new Date(String(data.get("checked_at") || ""));
          if (!Number.isFinite(observedAt.getTime())) {
            setDateError("请填写完整的实际观察日期和时间。");
            return;
          }
          setDateError("");
          void submit({
            ...Object.fromEntries(data),
            app_installed: data.has("app_installed"),
            checked_at: observedAt.toISOString(),
            expected_revision: current.revision,
          } as Observation);
        }}
      >
        <fieldset disabled={busy || current.status !== "published"}>
          <div className="broadcast-field-grid">
            {[
              ["platform_app", "平台App与版本"],
              ["os_version", "系统与版本"],
              ["calendar_client", "日历客户端与版本"],
              ["region", "观看地区代码"],
              ["conditions", "登录/订阅与网页回退情况"],
              ["evidence_ref", "验收记录编号"],
            ].map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  name={key}
                  required
                  maxLength={
                    key === "conditions"
                      ? 300
                      : key === "evidence_ref"
                        ? 200
                        : 100
                  }
                  value={values[key as keyof typeof values] as string}
                  onChange={(e) =>
                    update(
                      key,
                      key === "region"
                        ? e.target.value.toUpperCase()
                        : e.target.value,
                    )
                  }
                />
              </label>
            ))}
          </div>
          <label>
            实际观察时间（当前设备时区）
            <input
              name="checked_at"
              type="datetime-local"
              required
              value={values.checked_at}
              onChange={(e) => update("checked_at", e.target.value)}
            />
          </label>
          <label className="broadcast-check">
            <input
              name="app_installed"
              type="checkbox"
              checked={values.app_installed}
              onChange={(e) => update("app_installed", e.target.checked)}
            />
            已安装目标平台App
          </label>
          <div className="broadcast-field-grid">
            {[
              ["exact_content", "L1 内容对应"],
              ["app_content", "L2 App内具体内容"],
              ["playback", "L3 实际播放"],
            ].map(([key, label]) => (
              <label key={key}>
                {label}
                <select
                  name={key}
                  value={values[key as keyof typeof values] as string}
                  onChange={(e) => update(key, e.target.value)}
                >
                  <option value="not_tested">未测试</option>
                  <option value="passed">通过</option>
                  <option value="failed">未通过</option>
                </select>
              </label>
            ))}
          </div>
          {dateError && <p role="alert">{dateError}</p>}
          <button type="submit">保存设备观察</button>
        </fieldset>
      </form>
    </details>
  );
}
