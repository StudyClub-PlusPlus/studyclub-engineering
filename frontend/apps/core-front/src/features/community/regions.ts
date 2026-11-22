/**
 * 크루가 참여하는 지역 — 소개의 지도와 세계 시계가 함께 읽는다.
 * 출처: 운영진 「스터디클럽 소개」 문서의 지역(미국 서부·동부, 한국, 캐나다, 유럽 스위스·독일)과
 * 후기에 적힌 도시(베이 에어리어, 세인트루이스, 뉴욕, 서울). 2026-10-18 기준.
 * 캐나다는 도시 근거가 없어 지도 핀·시간대를 대표값(밴쿠버 위치·태평양 시간)으로 둔다 — 실제 도시를 알면 고친다.
 */
export type Region = {
  id: string;
  /** public/about-art/<art>.webp */
  art: string;
  name: { ko: string; en: string };
  city: { ko: string; en: string };
  tz: string;
  lat: number;
  lon: number;
  color: string;
  soft: string;
};

const US = { color: 'var(--color-info-600)', soft: 'var(--color-info-50)', art: 'region-us' };

export const REGIONS: Region[] = [
  { id: 'us-west', ...US, name: { ko: '미국 서부', en: 'US West' }, city: { ko: '베이 에어리어', en: 'Bay Area' }, tz: 'America/Los_Angeles', lat: 37.5, lon: -122.2 },
  { id: 'us-central', ...US, name: { ko: '미국 중부', en: 'US Central' }, city: { ko: '세인트루이스', en: 'St. Louis' }, tz: 'America/Chicago', lat: 38.6, lon: -90.2 },
  { id: 'us-east', ...US, name: { ko: '미국 동부', en: 'US East' }, city: { ko: '뉴욕', en: 'New York' }, tz: 'America/New_York', lat: 40.7, lon: -74 },
  {
    id: 'ca',
    art: 'region-ca',
    name: { ko: '캐나다', en: 'Canada' },
    // 소개 문서엔 「캐나다」만 있다 — 도시는 모른다. 시계는 서부 시간을 대표값으로
    city: { ko: '캐나다 서부 시간 기준', en: 'Pacific time shown' },
    tz: 'America/Vancouver',
    lat: 49.3,
    lon: -123.1,
    color: 'var(--color-warning-600)',
    soft: 'var(--color-warning-50)',
  },
  {
    id: 'kr',
    art: 'region-kr',
    name: { ko: '한국', en: 'Korea' },
    city: { ko: '서울', en: 'Seoul' },
    tz: 'Asia/Seoul',
    lat: 37.6,
    lon: 127,
    color: 'var(--color-error-600)',
    soft: 'var(--color-error-50)',
  },
  {
    id: 'eu',
    art: 'region-eu',
    name: { ko: '유럽', en: 'Europe' },
    // 소개 문서: 유럽(스위스·독일). 두 나라 모두 중부유럽 시간이다
    city: { ko: '스위스 · 독일', en: 'Switzerland · Germany' },
    tz: 'Europe/Zurich',
    lat: 47.4,
    lon: 8.5,
    color: 'var(--color-success-600)',
    soft: 'var(--color-success-50)',
  },
];

/** public/about-art/world-dots.svg 와 같은 투영(경위도 그대로, 위도 75 ~ -56) — 바꾸면 SVG 도 다시 만든다 */
export const MAP = { top: 75, bottom: -56 };
export function project(lat: number, lon: number): { left: string; top: string } {
  return {
    left: `${((lon + 180) / 360) * 100}%`,
    top: `${((MAP.top - lat) / (MAP.top - MAP.bottom)) * 100}%`,
  };
}

/** 시간대 약어(PDT·KST 등)와 UTC 차이 */
export function tzLabel(tz: string, at = new Date()): { abbr: string; offset: string } {
  const abbr =
    new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' }).formatToParts(at).find((p) => p.type === 'timeZoneName')
      ?.value ?? '';
  const offset =
    new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(at).find((p) => p.type === 'timeZoneName')
      ?.value.replace('GMT', 'UTC') ?? '';
  // Asia/Seoul 은 en-US 에서 약어가 GMT+9 로 나온다 — 약어가 없으면 오프셋만
  return { abbr: abbr.startsWith('GMT') ? '' : abbr, offset: offset === 'UTC' ? 'UTC+0' : offset };
}
