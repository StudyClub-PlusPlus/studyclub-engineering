// 경량 i18n — 정적 UI 문자열 사전 (ko/en).
import type { L10n, Locale } from "./content";

export const LOCALES: Locale[] = ["ko", "en"];
export const DEFAULT_LOCALE: Locale = "ko";

export function isLocale(v: string): v is Locale {
  return (LOCALES as string[]).includes(v);
}

/** L10n 객체에서 locale 값 뽑기 (ko fallback) */
export function t(value: L10n | undefined, locale: Locale): string {
  if (!value) return "";
  return value[locale] || value.ko || "";
}

type Dict = Record<string, L10n>;

export const MESSAGES: Dict = {
  "nav.home": { ko: "홈", en: "Home" },
  "nav.studies": { ko: "스터디", en: "Studies" },
  "nav.events": { ko: "행사", en: "Events" },
  "nav.about": { ko: "소개", en: "About" },
  "nav.mentoring": { ko: "멘토링", en: "Mentoring" },
  "nav.join": { ko: "디스코드 합류", en: "Join Discord" },

  "issue.label": { ko: "StudyClub++ · Vol.1", en: "StudyClub++ · Vol.1" },

  "hero.eyebrow": { ko: "StudyClub++", en: "StudyClub++" },
  "hero.title": { ko: "미국·캐나다·한국이 함께하는\n글로벌 스터디 클럽++", en: "A global study club++\nacross the US, Canada & Korea" },
  "hero.subtitle": {
    ko: "미국·캐나다·한국의 개발자 2,000여 명이 함께하는 글로벌 커뮤니티. 이력서·인터뷰·시스템 디자인부터 AI까지, 현직자와 함께 준비합니다.",
    en: "A global community of 2,000+ engineers across the US, Canada, and Korea. From resumes and interviews to system design and AI — prepared together with working engineers.",
  },
  "hero.cta": { ko: "지금 합류하기", en: "Join now" },
  "hero.cta_studies": { ko: "스터디 둘러보기", en: "Browse studies" },

  "studies.title": { ko: "스터디", en: "Studies" },
  "studies.subtitle": { ko: "지금 열려 있는 코호트와 지난 기수.", en: "Open cohorts and past sessions." },
  "events.title": { ko: "행사", en: "Events" },
  "events.subtitle": { ko: "미국·한국·캐나다에서 열린 밋업·워크샵·직업탐방.", en: "Meetups, workshops, and career talks held across the US, Korea, and Canada." },
  "about.title": { ko: "소개", en: "About" },
  "about.subtitle": { ko: "우리가 누구이고, 무엇을 하는지.", en: "Who we are and what we do." },
  "about.operators": { ko: "운영진", en: "Organizers" },

  "status.recruiting": { ko: "모집 중", en: "Recruiting" },
  "status.ongoing": { ko: "진행 중", en: "Ongoing" },
  "status.closed": { ko: "종료", en: "Closed" },

  "format.online": { ko: "온라인", en: "Online" },
  "format.offline": { ko: "오프라인", en: "Offline" },
  "format.hybrid": { ko: "하이브리드", en: "Hybrid" },

  "common.seats": { ko: "정원", en: "Seats" },
  "common.lead": { ko: "운영", en: "Lead" },
  "common.schedule": { ko: "일정", en: "Schedule" },
  "common.format": { ko: "형식", en: "Format" },
  "common.tags": { ko: "주제", en: "Topics" },
  "common.back_studies": { ko: "스터디 목록", en: "All studies" },
  "common.back_events": { ko: "행사 목록", en: "All events" },
  "common.apply_discord": { ko: "디스코드로 신청", en: "Apply on Discord" },
  "common.rsvp": { ko: "신청 / 자세히", en: "RSVP / Details" },
  "common.about_study": { ko: "스터디 소개", en: "About this study" },
  "common.participants": { ko: "참여 스터디원", en: "Participants" },
  "common.when": { ko: "일시", en: "When" },
  "common.where": { ko: "장소", en: "Where" },
  "common.type": { ko: "형태", en: "Type" },
  "common.not_found": { ko: "찾을 수 없어요", en: "Not found" },
  "common.mentoring": { ko: "멘토링", en: "Mentoring" },
  "common.join_cta_title": { ko: "디스코드에서 시작하세요", en: "Get started on Discord" },
  "common.join_cta_body": {
    ko: "모든 스터디와 행사는 디스코드에서 운영됩니다. 합류하고 다음 코호트를 기다리세요.",
    en: "Every study and event runs on Discord. Join and catch the next cohort.",
  },
  "footer.tagline": { ko: "미국·캐나다·한국이 함께하는 글로벌 개발자 스터디 클럽", en: "A global engineer study club across the US, Canada & Korea" },
};

export function m(key: string, locale: Locale): string {
  return t(MESSAGES[key], locale);
}
