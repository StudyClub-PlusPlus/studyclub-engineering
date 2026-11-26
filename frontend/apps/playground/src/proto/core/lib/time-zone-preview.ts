import { dateWithDow, wallParts } from './meetings';

export function localDateTime(at: Date, zone: string): string {
  const wall = wallParts(at, zone);
  return dateWithDow(wall.date) + ' ' + wall.time;
}

/** 기준 지역과 조회 지역의 시차가 달라지는 회차만 반환한다. */
export function relativeTimeChanges(instants: string[], sourceZone: string, viewerZone: string) {
  const difference = (at: Date) => {
    const source = wallParts(at, sourceZone);
    const viewer = wallParts(at, viewerZone);
    return Date.parse(viewer.date + 'T' + viewer.time + ':00Z') - Date.parse(source.date + 'T' + source.time + ':00Z');
  };
  const ordered = [...instants].sort();
  const changes: { at: string; before: string; after: string }[] = [];
  for (let i = 1; i < ordered.length; i += 1) {
    const previous = new Date(ordered[i - 1]!);
    const current = new Date(ordered[i]!);
    const before = difference(previous);
    const after = difference(current);
    if (before === after) continue;
    const source = wallParts(current, sourceZone);
    const previousClock = new Date(Date.parse(source.date + 'T' + source.time + ':00Z') + before);
    changes.push({
      at: ordered[i]!,
      before: previousClock.toISOString().slice(11, 16),
      after: wallParts(current, viewerZone).time,
    });
  }
  return changes;
}
