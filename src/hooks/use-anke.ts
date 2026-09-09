"use client";
import { useCallback, useEffect, useState } from "react";
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
  const refresh = useCallback(() => setEpoch((x) => x + 1), []);
  const refreshUser = useCallback(async () => {
    try {
      setUser(await api<CalendarUser>("/me/calendar"));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setUser(null);
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
    if (!status) return;
    const controller = new AbortController();
    api<{ items: Source[] }>(`/sources?dataset=${dataset}`, {
      signal: controller.signal,
    })
      .then((x) => setSources(x.items))
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [dataset, status, epoch]);
  useEffect(() => {
    if (!user || user.feed.status !== "updating") return;
    const timer = setInterval(refreshUser, 2000);
    return () => clearInterval(timer);
  }, [user, refreshUser]);
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
