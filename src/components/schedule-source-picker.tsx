"use client";

import { useEffect, useMemo, useState } from "react";
import type { Source } from "@/lib/types";
import { SelectMenu, type SelectMenuGroup } from "./select-menu";

function isDirectSchedule(source: Source) {
  return source.kind === "competition" && source.sport === "racing";
}

function leagueDirectories(sources: Source[]) {
  return sources.filter(
    (source) =>
      source.kind === "competition" &&
      source.sport !== "racing" &&
      sources.some(
        (candidate) =>
          candidate.kind === "team" && candidate.sport === source.sport,
      ),
  );
}

export function defaultScheduleSourceId(sources: Source[]) {
  const direct = sources.filter(isDirectSchedule);
  return (
    (
      direct.find(
        (source) =>
          source.id === "jolpica:f1" ||
          source.short_name.toUpperCase() === "F1",
      ) || direct[0]
    )?.id || ""
  );
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
  const directSources = useMemo(
    () => sources.filter(isDirectSchedule),
    [sources],
  );
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
      (selectedSource && isDirectSchedule(selectedSource)
        ? selectedSource.id
        : defaultScheduleSourceId(sources)),
  );

  useEffect(() => {
    if (selectedSourceLeague) {
      setDirectoryId(selectedSourceLeague.id);
      return;
    }
    if (selectedSource && isDirectSchedule(selectedSource)) {
      setDirectoryId(selectedSource.id);
      return;
    }
    setDirectoryId((current) =>
      directSources.some((source) => source.id === current) ||
      leagues.some((league) => league.id === current)
        ? current
        : defaultScheduleSourceId(sources),
    );
  }, [directSources, leagues, selectedSource, selectedSourceLeague, sources]);

  const selectedLeague = leagues.find((league) => league.id === directoryId);
  const teams = useMemo(
    () =>
      selectedLeague
        ? sources
            .filter(
              (source) =>
                source.kind === "team" && source.sport === selectedLeague.sport,
            )
            .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"))
        : [],
    [selectedLeague, sources],
  );
  const directoryGroups = useMemo<SelectMenuGroup[]>(() => {
    const groups: SelectMenuGroup[] = [];
    if (directSources.length) {
      groups.push({
        label: "赛事",
        options: directSources.map((source) => ({
          value: source.id,
          label: source.short_name || source.name,
        })),
      });
    }
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
  }, [directSources, leagues]);
  const teamGroups = useMemo<SelectMenuGroup[]>(
    () => [
      {
        label: selectedLeague?.short_name || selectedLeague?.name || "球队",
        options: [
          { value: "", label: "选择球队" },
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
        loading={!directSources.length && !leagues.length}
        className="select-menu--quiet"
        onChange={(nextId) => {
          setDirectoryId(nextId);
          onSelect(
            directSources.some((source) => source.id === nextId) ? nextId : "",
          );
        }}
      />
      {selectedLeague && (
        <SelectMenu
          ariaLabel={`选择${selectedLeague.short_name || selectedLeague.name}球队`}
          groups={teamGroups}
          value={
            teams.some((team) => team.id === selectedSourceId)
              ? selectedSourceId
              : ""
          }
          placeholder="选择球队"
          className="select-menu--quiet"
          onChange={onSelect}
        />
      )}
    </div>
  );
}
