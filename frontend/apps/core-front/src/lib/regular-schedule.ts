import {
  DOW_LABEL,
  dowOf,
  isKickoff,
  wallParts,
  zonedInstant,
  zoneTitle,
  type NavigatorGroup,
  type ProtoMeeting,
} from '@/lib/meetings';

/** 정규 요일·시각은 반 설정을 유지하고, 가까운 회차 날짜의 시차로 표시만 환산한다. */
export function regularScheduleDisplay(
  group: NavigatorGroup,
  meetings: ProtoMeeting[],
  viewerZone: string,
  now = new Date(),
) {
  if (!group.startAt) return { label: '미정', original: '미정', referenceDate: '' };
  const regular = meetings
    .filter((m) => !isKickoff(m))
    .map((m) =>
      m.scheduledAt ? new Date(m.scheduledAt) : zonedInstant(m.date, m.time ?? group.startAt, group.timeZone),
    )
    .sort((a, b) => a.getTime() - b.getTime());
  // 종료한 반은 마지막 회차, 회차가 없는 반은 오늘의 시차를 기준으로 삼는다.
  const reference = regular.find((at) => at >= now) ?? regular.at(-1) ?? now;
  const referenceDate = wallParts(reference, group.timeZone).date;
  const weekdays = [...new Set(group.weekdays ?? [])].sort((a, b) => a - b);
  const at = zonedInstant(referenceDate, group.startAt, group.timeZone);
  const label = (zone: string) => {
    const { date, time } = wallParts(at, zone);
    const dayShift = dowOf(date) - dowOf(referenceDate);
    const days = weekdays.map((day) => DOW_LABEL[(day + dayShift + 7) % 7]).join('·');
    return `${days ? `매주 ${days}요일 ` : ''}${time} · ${zoneTitle(zone, at)}`;
  };
  return { label: label(viewerZone), original: label(group.timeZone), referenceDate };
}
