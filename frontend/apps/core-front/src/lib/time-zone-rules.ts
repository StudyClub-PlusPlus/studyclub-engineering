/**
 * B.C. keeps UTC−7 after its final spring-forward on 2026-03-08 at 10:00 UTC.
 * Older browser/Node tzdata still applies the November fall-back to Vancouver.
 * Apply the confirmed rule at the formatting boundary; keep the user's IANA ID
 * in profiles and meeting storage, and retain historical rules before the change.
 * https://archive.news.gov.bc.ca/releases/news_releases_2024-2028/2026AG0013-000209.htm
 * https://news.gov.bc.ca/releases/2026CITZ0009-001073 (PCT abbreviation)
 * Revisit this compatibility rule if B.C. changes its time standard again.
 */
const VANCOUVER_PERMANENT_TIME_START = Date.UTC(2026, 2, 8, 10);

export function usesVancouverPacificTime(zone: string, at: Date): boolean {
  return (zone === 'America/Vancouver' || zone === 'Canada/Pacific') && at.getTime() >= VANCOUVER_PERMANENT_TIME_START;
}

/** Etc/GMT signs are reversed: GMT+7 represents UTC−7. Never persist this ID. */
export function formattingZone(zone: string, at: Date): string {
  return usesVancouverPacificTime(zone, at) ? 'Etc/GMT+7' : zone;
}
