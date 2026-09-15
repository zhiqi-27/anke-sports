"use client";

import { useEffect, useMemo, useState } from "react";
import { Broadcast, Check, GlobeHemisphereWest } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import type { CalendarUser } from "@/lib/types";

type BroadcastPlatform = {
  id: string;
  name: string;
  mobile_opening: "verified_https_app_link" | "web_handoff";
  rights: {
    competition_id: string;
    regions: string[];
    valid_through: string | null;
  }[];
};

const competitions: Record<string, string> = {
  "jolpica:f1": "Formula 1",
  "balldontlie:nba": "NBA",
  "football-data:PL": "英超",
};

const regions = [
  ["CN", "中国大陆"],
  ["US", "美国"],
  ["JP", "日本"],
  ["GB", "英国"],
  ["IE", "爱尔兰"],
  ["FR", "法国"],
  ["DE", "德国"],
  ["AT", "奥地利"],
  ["CH", "瑞士"],
  ["IT", "意大利"],
  ["ES", "西班牙"],
  ["PT", "葡萄牙"],
  ["NL", "荷兰"],
  ["BE", "比利时"],
  ["DK", "丹麦"],
  ["FI", "芬兰"],
  ["NO", "挪威"],
  ["SE", "瑞典"],
  ["PL", "波兰"],
] as const;

type Props = {
  user: CalendarUser | null;
  busy: boolean;
  requireUser: (action: () => void) => void;
  run: (
    action: () => Promise<unknown>,
    success?: () => void,
  ) => Promise<boolean>;
};

export function BroadcastPreferences({ user, busy, requireUser, run }: Props) {
  const [platforms, setPlatforms] = useState<BroadcastPlatform[]>([]);
  const [region, setRegion] = useState(
    user?.config.preferences.watch_region || "",
  );
  const [draft, setDraft] = useState<Record<string, string>>(
    user?.config.preferences.broadcast_platforms || {},
  );

  useEffect(() => {
    api<{ items: BroadcastPlatform[] }>("/platforms")
      .then((data) => setPlatforms(data.items))
      .catch(() => setPlatforms([]));
  }, []);
  useEffect(() => {
    setRegion(user?.config.preferences.watch_region || "");
    setDraft(user?.config.preferences.broadcast_platforms || {});
  }, [user?.id, user?.revision]);

  const regionalRights = useMemo(
    () =>
      Object.keys(competitions).map((competitionId) => ({
        competitionId,
        platforms: platforms.filter((platform) =>
          platform.rights.some(
            (right) =>
              right.competition_id === competitionId &&
              right.regions.includes(region),
          ),
        ),
      })),
    [platforms, region],
  );

  return (
    <section
      className="broadcast-preferences"
      aria-labelledby="broadcast-preferences-title"
    >
      <div className="section-toolbar">
        <div>
          <span className="eyebrow">直播</span>
          <h2 id="broadcast-preferences-title">按地区和联赛选择直播方</h2>
          <p>赛事详情使用这里的偏好；个人日历每场只保留一个直播链接。</p>
        </div>
        <Broadcast size={28} weight="duotone" />
      </div>
      <label className="broadcast-region-field">
        <span>
          <GlobeHemisphereWest size={16} /> 观看地区
        </span>
        <select
          aria-label="直播观看地区"
          value={region}
          onChange={(event) => setRegion(event.target.value)}
        >
          <option value="">选择地区</option>
          {regions.map(([code, name]) => (
            <option value={code} key={code}>
              {name}
            </option>
          ))}
        </select>
      </label>
      {region ? (
        <div className="broadcast-league-list">
          {regionalRights.map(({ competitionId, platforms: choices }) => {
            const preferenceKey = `${region}:${competitionId}`;
            return (
              <label className="broadcast-league-row" key={competitionId}>
                <span>
                  <b>{competitions[competitionId]}</b>
                  <small>
                    {choices.length
                      ? `${choices.length} 个已核验版权方`
                      : "当前地区尚无已核验版权方"}
                  </small>
                </span>
                <select
                  aria-label={`${competitions[competitionId]}首选直播方`}
                  disabled={!choices.length}
                  value={draft[preferenceKey] || ""}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      [preferenceKey]: event.target.value,
                    }))
                  }
                >
                  <option value="">自动选择</option>
                  {choices.map((platform) => (
                    <option key={platform.id} value={platform.id}>
                      {platform.name}
                      {platform.mobile_opening === "verified_https_app_link"
                        ? " · 支持 App Link"
                        : " · 官方网页"}
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>
      ) : (
        <p className="broadcast-region-empty">
          先选择观看地区，再按联赛设置直播方。
        </p>
      )}
      <div className="creator-actions">
        <button
          className="primary-button"
          disabled={!user || !region || busy}
          onClick={() =>
            requireUser(() =>
              run(() =>
                api("/me/preferences", {
                  method: "PATCH",
                  body: JSON.stringify({
                    preferences: {
                      ...user!.config.preferences,
                      watch_region: region,
                      broadcast_platforms: draft,
                    },
                    expected_revision: user!.revision,
                  }),
                }),
              ),
            )
          }
        >
          <Check size={16} />
          保存直播偏好
        </button>
      </div>
    </section>
  );
}
