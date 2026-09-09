"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { CalendarUser, ServiceStatus, Source } from "@/lib/types";

export function useAnke() {
  const [user, setUser] = useState<CalendarUser | null>(null);
  const [status, setStatus] = useState<ServiceStatus | null>(null);
  const [dataset, setDataset] = useState("demo");
  const [sources, setSources] = useState<Source[]>([]);
  const [error, setError] = useState("");
  const [epoch, setEpoch] = useState(0);
  const [busy, setBusy] = useState(false);
  const userRequest = useRef(0);
  const statusReady = status !== null;
  const userReady = user !== null;
  const personalPending = Boolean(
    user &&
    (user.feed.status === "updating" ||
      user.creators.some((c) => c.enabled && c.sync_status === "syncing")),
  );
  const refresh = useCallback(() => setEpoch((x) => x + 1), []);
  const refreshUser = useCallback(async () => {
    const request = ++userRequest.current;
    try {
      const account = await api<CalendarUser>("/me/calendar");
      if (request === userRequest.current) setUser(account);
    } catch (e) {
      if (request !== userRequest.current) return;
      if (
        e instanceof ApiError &&
        (e.status === 401 || e.code === "ACCOUNT_DELETED")
      )
        setUser(null);
      else setError(e instanceof Error ? e.message : "连接失败");
    }
  }, []);
  useEffect(() => {
    api<ServiceStatus>("/status")
      .then((s) => {
        setStatus(s);
        setDataset(
          localStorage.getItem("anke-dataset") ||
            (s.local_preview ? "demo" : "real"),
        );
      })
      .catch(() => setError("暂时无法连接日历服务，请确认后端正在运行"));
  }, []);
  useEffect(() => {
    void refreshUser();
    if (epoch)
      api<ServiceStatus>("/status")
        .then(setStatus)
        .catch(() => {});
  }, [refreshUser, epoch]);
  useEffect(() => {
    const revisit = () => {
      void refreshUser();
    };
    window.addEventListener("focus", revisit);
    window.addEventListener("pageshow", revisit);
    return () => {
      window.removeEventListener("focus", revisit);
      window.removeEventListener("pageshow", revisit);
      userRequest.current++;
    };
  }, [refreshUser]);
  useEffect(() => {
    if (!statusReady) return;
    const controller = new AbortController();
    api<{ items: Source[] }>(`/sources?dataset=${dataset}`, {
      signal: controller.signal,
    })
      .then((x) => setSources(x.items))
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [dataset, statusReady, epoch]);
  useEffect(() => {
    const activeProvider = status?.providers.some(
      (p) => p.activity === "queued" || p.activity === "running",
    );
    const waitingProvider = status?.providers.some(
      (p) => p.activity === "waiting",
    );
    const waitingYouTube = status?.youtube_budget?.state === "waiting";
    if (
      !userReady ||
      (!personalPending &&
        !activeProvider &&
        !waitingProvider &&
        !waitingYouTube)
    )
      return;
    let cancelled = false;
    const timer = setInterval(
      () => {
        void refreshUser();
        if (
          activeProvider ||
          waitingProvider ||
          personalPending ||
          waitingYouTube
        )
          void api<ServiceStatus>("/status")
            .then((next) => {
              if (!cancelled) {
                setStatus(next);
                if (
                  next.providers.some(
                    (p) =>
                      p.last_success !==
                      status?.providers.find((old) => old.id === p.id)
                        ?.last_success,
                  )
                )
                  refresh();
              }
            })
            .catch(() => {});
      },
      activeProvider || (personalPending && !waitingYouTube) ? 2000 : 30000,
    );
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [userReady, personalPending, status, refreshUser, refresh]);
  const run = useCallback(
    async (action: () => Promise<unknown>, success?: () => void) => {
      setBusy(true);
      setError("");
      try {
        await action();
        refresh();
        success?.();
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "操作失败，请重试");
        // Also reveal service-wide waits caused by an interactive request.
        void api<ServiceStatus>("/status")
          .then(setStatus)
          .catch(() => {});
        return false;
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );
  const changeDataset = (value: string) => {
    setDataset(value);
    localStorage.setItem("anke-dataset", value);
  };
  return {
    user,
    status,
    dataset,
    sources,
    error,
    setError,
    epoch,
    busy,
    refresh,
    run,
    changeDataset,
  };
}
