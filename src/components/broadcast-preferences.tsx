"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Broadcast,
  CaretDown,
  GlobeHemisphereWest,
} from "@phosphor-icons/react";
import { api } from "@/lib/api";
import type { Preferences } from "@/lib/types";
import { SelectMenu } from "./select-menu";

type BroadcastPlatform = {
  id: string;
  name: string;
  mobile_opening: "verified_https_app_link" | "web_handoff";
  rights: {
    competition_id: string;
    regions: string[];
    valid_through: string | null;
    product_url?: string | null;
    product_title?: string | null;
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
  preferences: Preferences;
  onChange: (preferences: Preferences) => void;
};

export function BroadcastPreferences({ preferences, onChange }: Props) {
  const [platforms, setPlatforms] = useState<BroadcastPlatform[]>([]);
  const [expanded, setExpanded] = useState(Boolean(preferences.watch_region));
  const region = preferences.watch_region || "";
  const draft = preferences.broadcast_platforms || {};
  const regionName = regions.find(([code]) => code === region)?.[1];

  useEffect(() => {
    api<{ items: BroadcastPlatform[] }>("/platforms")
      .then((data) => setPlatforms(data.items))
      .catch(() => setPlatforms([]));
  }, []);
  const regionalRights = useMemo(
    () =>
      Object.keys(competitions).map((competitionId) => ({
        competitionId,
        platforms: platforms.filter((platform) =>
          platform.rights.some(
            (right) =>
              right.competition_id === competitionId &&
              right.regions.includes(region) &&
              Boolean(right.product_url),
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
      <button
        type="button"
        className="broadcast-summary"
        aria-expanded={expanded}
        aria-controls="broadcast-preferences-content"
        onClick={() => setExpanded((value) => !value)}
      >
        <span className="broadcast-summary-icon">
          <Broadcast size={20} weight="duotone" />
        </span>
        <span>
          <b id="broadcast-preferences-title">直播方偏好</b>
          <small>
            {regionName
              ? `${regionName} · 可按联赛覆盖自动选择`
              : "默认添加候选版权方的直播产品；可按观看地区自定义"}
          </small>
        </span>
        <CaretDown className="broadcast-summary-caret" size={16} />
      </button>
      {expanded && (
        <div
          className="broadcast-preferences-content"
          id="broadcast-preferences-content"
        >
          <div className="broadcast-region-field">
            <span>
              <GlobeHemisphereWest size={16} /> 观看地区
            </span>
            <SelectMenu
              ariaLabel="直播观看地区"
              value={region}
              placeholder="选择地区"
              className="broadcast-select-menu"
              searchable
              searchPlaceholder="搜索国家或地区"
              groups={[
                {
                  options: [
                    { value: "", label: "自动（不指定地区）" },
                    ...regions.map(([value, label]) => ({ value, label })),
                  ],
                },
              ]}
              onChange={(value) =>
                onChange({ ...preferences, watch_region: value || null })
              }
            />
          </div>
          {region ? (
            <div className="broadcast-league-list">
              {regionalRights.map(({ competitionId, platforms: choices }) => {
                const preferenceKey = `${region}:${competitionId}`;
                return (
                  <div className="broadcast-league-row" key={competitionId}>
                    <span>
                      <b>{competitions[competitionId]}</b>
                      <small>
                        {choices.length
                          ? `${choices.length} 个可用直播产品`
                          : "当前地区暂无可用直播产品"}
                      </small>
                    </span>
                    <SelectMenu
                      ariaLabel={`${competitions[competitionId]}首选直播方`}
                      disabled={!choices.length}
                      value={draft[preferenceKey] || ""}
                      placeholder={choices.length ? "自动选择" : "暂无版权方"}
                      className="broadcast-select-menu"
                      groups={[
                        {
                          options: [
                            {
                              value: "",
                              label: "自动选择",
                              description: "按版权方产品顺序选择",
                            },
                            ...choices.map((platform) => ({
                              value: platform.id,
                              label: platform.name,
                              description:
                                platform.mobile_opening ===
                                "verified_https_app_link"
                                  ? "移动端 App 直达"
                                  : "官方网页",
                            })),
                          ],
                        },
                      ]}
                      onChange={(value) =>
                        onChange({
                          ...preferences,
                          broadcast_platforms: {
                            ...draft,
                            [preferenceKey]: value,
                          },
                        })
                      }
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="broadcast-region-empty">
              选择观看地区后，日历会按联赛版权覆盖自动添加直播产品。
            </p>
          )}
        </div>
      )}
    </section>
  );
}
