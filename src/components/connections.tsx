"use client";

import Link from "next/link";
import { BrandMark } from "./brand-mark";
import { useEffect, useState } from "react";
import { PlugsConnected, ShieldCheck } from "@phosphor-icons/react";
import { api, ApiError } from "@/lib/api";
import { GoogleSignIn } from "./google-sign-in";
import type { components } from "@/lib/generated";
import type { CalendarUser, ServiceStatus } from "@/lib/types";

type Consent = components["schemas"]["ConsentRequestView"];
type Connection = components["schemas"]["ConnectionView"];
const permissions: Record<string, [string, string]> = {
  "calendar:read": ["查看我的日历", "读取关注、赛程、视频内容与已保存的链接。"],
  "calendar:write": ["管理关注与链接", "修改关注、管理比赛链接和导入配置。"],
  "feed:read": [
    "读取私人订阅地址",
    "应用将能取得订阅地址。撤销应用后，如需使已取得的地址失效，请在日历订阅中更换地址。",
  ],
};

export function ConnectionConsent() {
  const [user, setUser] = useState<CalendarUser | null>(null);
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [pending, setPending] = useState("");
  const [consent, setConsent] = useState<Consent | null>(null);
  const [scopes, setScopes] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setPending(
      new URLSearchParams(window.location.search).get("request") || "",
    );
    let active = true;
    Promise.all([
      api<ServiceStatus>("/status"),
      api<CalendarUser>("/me/calendar").catch((e) => {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }),
    ])
      .then(([service, account]) => {
        if (active) {
          setStatus(service);
          setUser(account);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!user || !pending) return;
    const controller = new AbortController();
    api<Consent>(`/me/connections/requests/${encodeURIComponent(pending)}`, {
      signal: controller.signal,
    })
      .then((value) => {
        setConsent(value);
        setScopes(value.scopes.filter((scope) => scope !== "feed:read"));
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [user, pending]);

  async function loginLocal() {
    setBusy(true);
    setError("");
    try {
      await api("/auth/local", { method: "POST" });
      setUser(await api<CalendarUser>("/me/calendar"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "登录未完成");
    } finally {
      setBusy(false);
    }
  }

  async function decide(approved: boolean) {
    if (busy || !consent) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<{ redirect_url: string }>(
        `/me/connections/requests/${encodeURIComponent(pending)}`,
        {
          method: "POST",
          body: JSON.stringify({ approved, scopes: approved ? scopes : [] }),
        },
      );
      // The backend returns only the exact registered callback from this request.
      window.location.assign(result.redirect_url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "授权未完成");
      setBusy(false);
    }
  }

  return (
    <main className="connect-page">
      <Link href="/calendar" className="connect-brand">
        <BrandMark size={32} /> Anke Sports
      </Link>
      <section className="consent-card" aria-labelledby="consent-heading">
        <ShieldCheck size={36} weight="duotone" />
        <h1 id="consent-heading">连接你的体育日历</h1>
        {status?.local_preview && (
          <p className="connection-local">本地体验 · 此授权只连接本机服务</p>
        )}
        {!ready && <p role="status">正在读取账号…</p>}
        {error && (
          <p className="connection-error" role="alert">
            {error}
          </p>
        )}
        {ready && !pending && (
          <p>请从需要连接的应用发起授权，再回到这里确认。</p>
        )}
        {ready && pending && !user && (
          <div className="connect-login">
            <p>登录 Anke Sports 后，查看应用请求的权限。</p>
            {status?.firebase_configured && (
              <GoogleSignIn
                disabled={busy}
                onSignedIn={(account) => {
                  setError("");
                  setUser(account);
                }}
              />
            )}
            {status?.local_preview && (
              <button
                className="primary-button"
                disabled={busy}
                onClick={loginLocal}
              >
                使用本地体验账号
              </button>
            )}
            {status && !status.firebase_configured && !status.local_preview && (
              <p>登录服务尚未配置。</p>
            )}
          </div>
        )}
        {user && pending && !consent && !error && (
          <p role="status">正在读取授权请求…</p>
        )}
        {user && consent && (
          <>
            <p>
              <strong>{consent.client_name}</strong> 请求访问{" "}
              <strong>{user.display_name}</strong> 的日历。
            </p>
            <p className="connection-muted">
              应用名称由申请方填写。只授权你正在连接的应用。
            </p>
            <dl className="connection-destination">
              <dt>返回应用</dt>
              <dd>{consent.redirect_uri}</dd>
              <dt>日历服务</dt>
              <dd>{consent.resource}</dd>
            </dl>
            <fieldset className="consent-permissions" disabled={busy}>
              <legend>允许这个应用</legend>
              {consent.scopes.map((scope) => (
                <label key={scope}>
                  <input
                    type="checkbox"
                    checked={scopes.includes(scope)}
                    onChange={(e) =>
                      setScopes(
                        e.target.checked
                          ? [...scopes, scope]
                          : scopes.filter((s) => s !== scope),
                      )
                    }
                  />
                  <span>
                    <strong>{permissions[scope]?.[0] || scope}</strong>
                    <small>{permissions[scope]?.[1]}</small>
                  </span>
                </label>
              ))}
            </fieldset>
            <p className="connection-muted">
              可在设置中随时撤销。连接最长保留 7 天，之后需要重新授权。
            </p>
            <div className="consent-actions">
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => decide(false)}
              >
                取消连接
              </button>
              <button
                className="primary-button"
                disabled={busy || !scopes.length}
                onClick={() => decide(true)}
              >
                {busy ? "正在处理…" : "允许连接"}
              </button>
            </div>
          </>
        )}
      </section>
      <Link href="/calendar" className="connection-muted">
        返回日历
      </Link>
    </main>
  );
}

export function ConnectionManager({ userId }: { userId?: string }) {
  const [items, setItems] = useState<Connection[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [epoch, setEpoch] = useState(0);
  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    setReady(false);
    api<{ items: Connection[] }>("/me/connections", {
      signal: controller.signal,
    })
      .then((result) => {
        setItems(result.items);
        setError("");
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setReady(true);
      });
    return () => controller.abort();
  }, [userId, epoch]);
  async function revoke(id: string) {
    setBusy(id);
    setError("");
    try {
      await api(`/me/connections/${id}`, { method: "DELETE" });
      setEpoch((x) => x + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "撤销未完成");
    } finally {
      setBusy("");
    }
  }
  return (
    <section className="connections-section">
      <h2>
        <PlugsConnected size={22} /> 已连接的应用
      </h2>
      <p className="connection-muted">管理外部 Agent 对日历的访问。</p>
      {error && (
        <p className="connection-error" role="alert">
          {error}{" "}
          <button
            className="secondary-button"
            onClick={() => setEpoch((x) => x + 1)}
          >
            重试
          </button>
        </p>
      )}
      {!userId ? (
        <p>登录后查看应用连接。</p>
      ) : !ready ? (
        <p role="status">正在读取连接…</p>
      ) : !error && !items.length ? (
        <p className="connections-empty">
          还没有连接应用。从 MCP 客户端发起连接后，在网页中确认权限。
        </p>
      ) : (
        <div className="settings-list">
          {items.map((item) => (
            <article className="connection-row" key={item.id}>
              <div>
                <h3>{item.client_name}</h3>
                <p>
                  {item.scopes.map((s) => permissions[s]?.[0] || s).join(" · ")}
                </p>
                <small>
                  有效至{" "}
                  {new Date(item.expires_at * 1000).toLocaleString("zh-CN")}
                </small>
              </div>
              <button
                className="secondary-button"
                disabled={!!busy}
                onClick={() => revoke(item.id)}
              >
                {busy === item.id ? "正在撤销…" : "撤销连接"}
              </button>
            </article>
          ))}
        </div>
      )}
      {items.some((item) => item.scopes.includes("feed:read")) && (
        <p className="connection-muted">
          已共享的私人订阅地址可在「日历订阅」中单独更换。
        </p>
      )}
    </section>
  );
}
