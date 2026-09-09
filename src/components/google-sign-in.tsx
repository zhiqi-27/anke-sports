"use client";

import { useRef, useState } from "react";
import { googleLogin } from "@/lib/api";
import type { CalendarUser } from "@/lib/types";

export function GoogleSignIn({
  disabled = false,
  onSignedIn,
}: {
  disabled?: boolean;
  onSignedIn: (account: CalendarUser) => void | Promise<void>;
}) {
  const active = useRef(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState("");
  const [copyNotice, setCopyNotice] = useState("");

  async function login() {
    if (active.current || disabled) return;
    active.current = true;
    setWaiting(true);
    setError("");
    try {
      const account = await googleLogin();
      await onSignedIn(account);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "登录未完成，请重试。");
    } finally {
      active.current = false;
      setWaiting(false);
    }
  }

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyNotice("地址已复制，请粘贴到 Chrome 或 Safari 中打开并登录。");
    } catch {
      setCopyNotice("请从地址栏复制页面地址，粘贴到 Chrome 或 Safari 中打开。");
    }
  }

  return (
    <div className="google-sign-in">
      <button
        className="primary-button full-width"
        disabled={disabled || waiting}
        onClick={login}
      >
        {waiting ? "正在等待 Google 登录…" : "使用 Google 登录"}
      </button>
      {error && (
        <p className="google-sign-in-error" role="alert">
          {error}
        </p>
      )}
      <p className="google-sign-in-help">
        登录会打开新窗口。如果窗口没有出现，或在应用内浏览器中无法完成，请复制地址到
        Chrome 或 Safari 中登录。
      </p>
      <button className="secondary-button" onClick={copyAddress}>
        复制当前页面地址
      </button>
      {copyNotice && (
        <p className="google-sign-in-help" role="status">
          {copyNotice}
        </p>
      )}
    </div>
  );
}
