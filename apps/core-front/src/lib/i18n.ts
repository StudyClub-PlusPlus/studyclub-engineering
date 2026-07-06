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
  "nav.guide": { ko: "가이드", en: "Guide" },
  "nav.notices": { ko: "공지", en: "Notices" },
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
  "about.operators": { ko: "캡틴", en: "Captains" },
  "about.captain_title": { ko: "캡틴이란?", en: "What's a Captain?" },
  "about.captain_body": {
    ko: "캡틴(Captain)은 StudyClub++ 의 자원봉사 운영진입니다. 스터디를 여는 초기 세팅 — 모집 광고, 디스코드 채널 개설, 킥오프 진행 — 을 도와, 스터디원이 공부에만 집중할 수 있게 합니다.",
    en: "Captains are StudyClub++'s volunteer organizers. They handle the initial setup for a study — recruiting, spinning up the Discord channel, and running the kickoff — so members can focus on studying.",
  },

  "guide.title": { ko: "가이드", en: "Guide" },
  "guide.subtitle": { ko: "스터디 클럽을 처음 접했다면 여기서 시작하세요.", en: "New to the study club? Start here." },

  "notices.title": { ko: "공지사항", en: "Notices" },
  "notices.subtitle": { ko: "모집·개편·밋업 등 최신 소식.", en: "Latest news — recruiting, updates, and meetups." },
  "notice_tag.notice": { ko: "공지", en: "Notice" },
  "notice_tag.update": { ko: "업데이트", en: "Update" },
  "notice_tag.recruit": { ko: "모집", en: "Recruiting" },
  "notice_tag.event": { ko: "행사", en: "Event" },

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

  // kind
  "kind.study": { ko: "스터디", en: "Study" },
  "kind.club": { ko: "클럽", en: "Club" },
  "kind.club_hint": { ko: "주기적 모집", en: "Recurring intake" },

  // recruitment status
  "recruit.open": { ko: "모집 중", en: "Open" },
  "recruit.monthly": { ko: "매달 모집", en: "Monthly" },
  "recruit.always": { ko: "상시 모집", en: "Always open" },
  "recruit.closed": { ko: "모집 마감", en: "Closed" },

  // detail sections
  "detail.recruitment": { ko: "모집 안내", en: "Recruitment" },
  "detail.deadline": { ko: "모집 기한", en: "Deadline" },
  "detail.kickoff": { ko: "킥오프", en: "Kickoff" },
  "detail.capacity": { ko: "모집 인원", en: "Capacity" },
  "detail.cadence": { ko: "주기", en: "Cadence" },
  "detail.apply": { ko: "모집 신청", en: "Apply" },
  "detail.recruit_closed": { ko: "모집이 마감되었어요", en: "Recruitment is closed" },
  "detail.goal": { ko: "목표", en: "Goal" },
  "detail.topics": { ko: "예시 주제", en: "Topics" },
  "detail.how_it_works": { ko: "진행 방식", en: "How it works" },
  "detail.duration": { ko: "기간 · 커리큘럼", en: "Duration & curriculum" },
  "detail.audience": { ko: "모집 대상", en: "Who can join" },
  "detail.reviews": { ko: "후기", en: "Reviews" },
  "detail.stats": { ko: "참여 통계", en: "Stats" },
  "detail.stat_participants": { ko: "누적 참여자", en: "Participants" },
  "detail.completion_rate": { ko: "완주율", en: "Completion rate" },
  "detail.past_participants": { ko: "지난 참여자", en: "Past participants" },
  "detail.people": { ko: "명", en: "" },
  "detail.tab_about": { ko: "설명", en: "About" },
  "detail.tab_members": { ko: "멤버", en: "Members" },
  "detail.tab_reviews": { ko: "리뷰", en: "Reviews" },
  "detail.tab_stats": { ko: "통계", en: "Stats" },
  "detail.empty_about": { ko: "아직 상세 소개가 준비 중이에요.", en: "Details are being prepared." },
  "detail.empty_members": { ko: "아직 공개된 참여자가 없어요.", en: "No participants to show yet." },
  "detail.empty_reviews": { ko: "아직 후기가 없어요.", en: "No reviews yet." },
  "detail.empty_stats": { ko: "아직 집계된 통계가 없어요.", en: "No stats yet." },

  // browsers (search + filter)
  "filter.search_studies": { ko: "스터디 검색 (제목·주제·태그)", en: "Search studies (title, topic, tag)" },
  "filter.search_events": { ko: "행사 검색 (제목·설명)", en: "Search events (title, description)" },
  "filter.kind": { ko: "종류", en: "Kind" },
  "filter.status": { ko: "상태", en: "Status" },
  "filter.type": { ko: "형태", en: "Type" },
  "filter.year": { ko: "연도", en: "Year" },
  "filter.date": { ko: "기간", en: "Date" },
  "filter.date_from": { ko: "시작일", en: "From" },
  "filter.date_to": { ko: "종료일", en: "To" },
  "filter.reset": { ko: "초기화", en: "Reset" },
  "filter.all": { ko: "전체", en: "All" },
  "filter.none": { ko: "조건에 맞는 결과가 없어요.", en: "No results match your filters." },

  // event types
  "event_type.meetup": { ko: "밋업", en: "Meetup" },
  "event_type.workshop": { ko: "워크샵", en: "Workshop" },
  "event_type.talk": { ko: "토크", en: "Talk" },
  "event_type.online": { ko: "온라인", en: "Online" },
};

export function m(key: string, locale: Locale): string {
  return t(MESSAGES[key], locale);
}
