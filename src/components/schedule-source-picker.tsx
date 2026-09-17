"use client";

import { useEffect, useMemo, useState } from "react";
import type { Source } from "@/lib/types";
import { SelectMenu, type SelectMenuGroup } from "./select-menu";

function leagueDirectories(sources: Source[]) {
  return sources.filter(
    (source) =>
      source.kind === "competition" &&
      sources.some(
        (candidate) =>
          candidate.kind === "team" &&
          candidate.sport === source.sport,
      ),
  );
}

export function defaultScheduleSourceId(sources: Source[]) {
  const teams = sources.filter((source) => source.kind === "team");
  return teams[0]?.id || "";
}

export function ScheduleSourcePicker({
  sources,
  selectedSourceId,
  onSelect,
  className = "",
}: {
  sources: Source[];
  selectedSourceId: string;
  onSelect: (sourceId: string) => void;
  className?: string;
}) {
  const leagues = useMemo(() => leagueDirectories(sources), [sources]);
  const selectedSource = sources.find(
    (source) => source.id === selectedSourceId,
  );
  const selectedSourceLeague =
    selectedSource?.kind === "team"
      ? leagues.find((league) => league.sport === selectedSource.sport)
      : undefined;
  const [directoryId, setDirectoryId] = useState(
    selectedSourceLeague?.id ||
      leagues.find((league) => league.sport === "racing")?.id ||
      leagues[0]?.id ||
      "",
  );

  useEffect(() => {
    if (selectedSourceLeague) {
      setDirectoryId(selectedSourceLeague.id);
      return;
    }
    setDirectoryId((current) =>
      leagues.some((league) => league.id === current)
        ? current
        : leagues.find((league) => league.sport === "racing")?.id ||
          leagues[0]?.id ||
          "",
    );
  }, [leagues, selectedSourceLeague]);

  const selectedLeague = leagues.find((league) => league.id === directoryId);
  const teamNoun = selectedLeague?.sport === "racing" ? "车队" : "球队";
  const teams = useMemo(
    () =>
      selectedLeague
        ? sources
            .filter(
              (source) =>
                source.kind === "team" &&
                source.sport === selectedLeague.sport,
            )
            .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"))
        : [],
    [selectedLeague, sources],
  );
  const directoryGroups = useMemo<SelectMenuGroup[]>(() => {
    const groups: SelectMenuGroup[] = [];
    if (leagues.length) {
      groups.push({
        label: "联赛",
        options: leagues.map((league) => ({
          value: league.id,
          label: league.short_name || league.name,
        })),
      });
    }
    return groups;
  }, [leagues]);
  const teamGroups = useMemo<SelectMenuGroup[]>(
    () => [
      {
        label:
          `${selectedLeague?.short_name || selectedLeague?.name || ""} ${teamNoun}`.trim(),
        options: [
          { value: "", label: `选择${teamNoun}` },
          ...teams.map((team) => ({ value: team.id, label: team.name })),
        ],
      },
    ],
    [selectedLeague, teams],
  );

  return (
    <div className={`schedule-source-picker ${className}`.trim()}>
      <SelectMenu
        ariaLabel="选择赛事或联赛"
        groups={directoryGroups}
        value={directoryId}
        placeholder="选择赛事或联赛"
        loading={!leagues.length}
        className="select-menu--quiet"
        onChange={(nextId) => {
          setDirectoryId(nextId);
          onSelect("");
        }}
      />
      {selectedLeague && (
        <SelectMenu
          ariaLabel={`选择${selectedLeague.short_name || selectedLeague.name}${teamNoun}`}
          groups={teamGroups}
          value={
            teams.some((team) => team.id === selectedSourceId)
              ? selectedSourceId
              : ""
          }
          placeholder={`选择${teamNoun}`}
          className="select-menu--quiet"
          onChange={onSelect}
        />
      )}
    </div>
  );
}
