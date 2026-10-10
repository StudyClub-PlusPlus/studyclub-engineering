/**
 * 고를 수 있는 시간대 (POL-0006).
 *
 * 화면 부품(`TimeZonePicker`)이 아니라 **값만 따로** 둔다 — client 파일에 두면 서버에서 그리는
 * 지면(기획 라이브러리)이 이 배열을 읽지 못한다.
 *
 * 오프셋은 적지 않는다 — 서머타임에 따라 북미가 한 시간씩 움직인다.
 */
export const ZONES = [
  { zone: 'Asia/Seoul', ko: '한국 · 서울', en: 'Korea · Seoul' },
  { zone: 'America/New_York', ko: '북미 동부 · 뉴욕, 토론토', en: 'North America East · New York, Toronto' },
  { zone: 'America/Vancouver', ko: '북미 서부 · 밴쿠버, LA', en: 'North America West · Vancouver, LA' },
] as const;
