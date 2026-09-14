"use client";

import { useEffect, useMemo, useState } from "react";
import type { Source } from "@/lib/types";

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

  return (
    <div className={`schedule-source-picker ${className}`.trim()}>
      <select
        aria-label="选择赛事或联赛"
        value={directoryId}
        onChange={(event) => {
          const nextId = event.target.value;
          setDirectoryId(nextId);
          onSelect(
            directSources.some((source) => source.id === nextId) ? nextId : "",
          );
        }}
        disabled={!directSources.length && !leagues.length}
      >
        {!directSources.length && !leagues.length && (
          <option value="">正在读取赛程</option>
        )}
        {!!directSources.length && (
          <optgroup label="赛事">
            {directSources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.short_name || source.name}
              </option>
            ))}
          </optgroup>
        )}
        {!!leagues.length && (
          <optgroup label="联赛">
            {leagues.map((league) => (
              <option key={league.id} value={league.id}>
                {league.short_name || league.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      {selectedLeague && (
        <select
          aria-label={`选择${selectedLeague.short_name || selectedLeague.name}球队`}
          value={
            teams.some((team) => team.id === selectedSourceId)
              ? selectedSourceId
              : ""
          }
          onChange={(event) => onSelect(event.target.value)}
        >
          <option value="">选择球队</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
