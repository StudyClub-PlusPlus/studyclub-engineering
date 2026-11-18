import type { StudyStatus } from '@studyclub/types';
import { z } from 'zod';

import { amplitude, analyticsEnabled, COMMON_PROPS } from './amplitude';
import { analyticsAllowed, analyticsUserId, analyticsClientId } from './analytics-privacy-state';

// ─── Shared shapes ────────────────────────────────────────────────────────────

type StudyBaseProps = {
  study_id: string;
  study_title_ko: string;
  study_category?: string;
  study_status?: StudyStatus;
};

type BookmarkSource = 'card_landing' | 'card_list' | 'detail' | 'saved_page';

/** 디스코드 연동을 마친 화면 — 온보딩 디스코드 단계 · 신청 전 연동 창 · 마이페이지 디스코드 줄 */
export type DiscordLinkSource = 'onboarding' | 'apply_gate' | 'my_page';

/** 디스코드 연동 실패 사유 — 팝업 단계(cancelled·popup_blocked)와 연동 API 단계(나머지) */
export type DiscordConnectFailReason =
  'cancelled' | 'popup_blocked' | 'not_in_guild' | 'already_linked' | 'session_expired' | 'error';

// ─── Page name enum ───────────────────────────────────────────────────────────

export type PageName =
  | 'landing'
  | 'studies_list'
  | 'study_detail'
  | 'events_list'
  | 'event_detail'
  | 'notices_list'
  | 'notice_detail'
  | 'about'
  | 'guide'
  | 'terms'
  | 'privacy'
  | 'login'
  | 'onboarding'
  | 'my_page'
  | 'my_studies'
  | 'saved_studies'
  | 'study_room_schedule'
  | 'study_room_attendance'
  | 'study_room_notice'
  | 'account_leave';

// ─── Event union ──────────────────────────────────────────────────────────────
// 이벤트명: Title Case  /  프로퍼티명: snake_case  (Amplitude 공식 권장)

export type AnalyticsEvent =
  // ── Navigation ──────────────────────────────────────────────────────────────
  | {
      name: 'Page Viewed';
      props: {
        page_name: PageName;
        locale: string;
        next_path?: string;
        referrer?: string;
        study_id?: string;
        current_category?: string;
      };
    }

  // ── Auth ─────────────────────────────────────────────────────────────────────
  | { name: 'Auth Google Login Clicked'; props: { popup_blocked: boolean } }
  | { name: 'Auth Apple Login Clicked'; props: { popup_blocked: boolean } }
  | { name: 'Auth OAuth Cancelled'; props: { error: string } }
  | { name: 'Auth Login Completed'; props: { is_new_user: boolean; next_path: string } }
  | { name: 'Auth Login Failed'; props: { error_message: string; http_status: number } }
  // 공통 규약 이벤트 — 서비스마다 같은 이름이라 서비스끼리 퍼널을 겹쳐 볼 수 있다.
  // 가입 정본은 서버(user.registered)가 같은 이름으로 보낸다. 여기 것은 퍼널용 프론트 사본.
  | { name: 'User Signed Up'; props: { method: 'google' | 'apple'; signup_surface: 'onboarding' } }
  | { name: 'User Logged In'; props: { method: 'google' | 'apple' } }

  // ── Onboarding ───────────────────────────────────────────────────────────────
  | { name: 'Onboarding Started'; props: { suggested_nickname: boolean } }
  | { name: 'Onboarding Nickname Submitted'; props: { used_suggested_name: boolean; nickname_length: number } }
  | { name: 'Onboarding Nickname Conflict'; props: { attempt_count: number } }
  | {
      name: 'Onboarding Consents Agreed';
      props: { terms_agreed: boolean; privacy_agreed: boolean; marketing_agreed: boolean };
    }
  | { name: 'Onboarding Completed'; props: { time_to_complete_sec: number; marketing_agreed: boolean } }
  | { name: 'Onboarding Discord Skipped'; props: { after_not_in_guild: boolean } }

  // ── Study exploration ────────────────────────────────────────────────────────
  | {
      name: 'Study Filter Tab Changed';
      props: { tab: 'all' | 'recruiting' | 'ongoing' | 'closed'; result_count: number; category: string };
    }
  | { name: 'Study Category Filtered'; props: { category: string; tab: string; result_count: number } }
  | { name: 'Study Searched'; props: { query_length: number; result_count: number; has_results: boolean } }
  | {
      name: 'Study Card Clicked';
      props: StudyBaseProps & { source: 'landing' | 'studies_list'; card_position: number };
    }
  | { name: 'Study Bookmarked'; props: { study_id: string; source: BookmarkSource } }
  | { name: 'Study Unbookmarked'; props: { study_id: string; source: BookmarkSource } }
  | { name: 'Hero CTA Clicked'; props: { cta_type: 'discord' | 'studies' } }
  | {
      name: 'Event Card Clicked';
      props: { event_id: string; event_title_ko: string; source: 'landing' | 'events_list' };
    }

  // ── Study application ────────────────────────────────────────────────────────
  | { name: 'Study Apply CTA Clicked'; props: StudyBaseProps & { has_external_form: boolean } }
  | { name: 'Study Apply External Opened'; props: { study_id: string; study_title_ko: string } }
  | { name: 'Study Apply Dialog Opened'; props: { study_id: string; has_fixed_schedule: boolean; my_region: string } }
  | {
      name: 'Study Apply Slots Selected';
      props: {
        study_id: string;
        selected_slots_count: number;
        selected_days: string[];
        region: string;
      };
    }
  | { name: 'Study Apply Motivation Entered'; props: { study_id: string; motivation_length: number } }
  | {
      name: 'Study Apply Submitted';
      props: StudyBaseProps & {
        has_fixed_schedule: boolean;
        selected_slots_count: number;
        region: string;
        schedule_confirmed: boolean;
      };
    }
  | { name: 'Study Apply Completed'; props: StudyBaseProps & { apply_type: 'internal' } }
  | {
      name: 'Study Apply Failed';
      props: { study_id: string; error_type: 'validation' | 'network' | 'server'; validation_field: string | null };
    }
  | {
      name: 'Study Apply Dialog Dismissed';
      props: { study_id: string; interaction_step: 'idle' | 'schedule' | 'slots' };
    }

  // ── Study room (참여 중인 스터디) ─────────────────────────────────────────────
  | { name: 'Study Presenter Registered'; props: { study_id: string; meeting_id: string; slot: 1 | 2 } }
  | { name: 'Study Presenter Unregistered'; props: { study_id: string; meeting_id: string; slot: 1 | 2 } }
  | { name: 'Study Discord Opened'; props: { study_id: string } }

  // ── My page ──────────────────────────────────────────────────────────────────
  | { name: 'My Discord Connected'; props: { source: DiscordLinkSource } }
  | {
      name: 'Discord Connect Failed';
      props: { source: DiscordLinkSource; reason: DiscordConnectFailReason; http_status: number | null };
    }
  | { name: 'My Profile Updated'; props: { changed_fields: string[]; new_region: string } };

// ─── User properties ─────────────────────────────────────────────────────────

export type UserProperties = {
  user_locale: 'ko' | 'en';
  user_region: string;
  is_onboarding_complete: boolean;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

// GA4 는 권장 이벤트 이름이어야 보고서가 붙는다 — 대응이 있는 것만 넘긴다 (규약 §2)
// sign_up 은 서버(Measurement Protocol)가 보낸다 — 여기서도 보내면 GA4 에 두 번 잡힌다
const GA4_EVENT: Partial<Record<AnalyticsEvent['name'], string>> = {
  'User Logged In': 'login',
};

type Gtag = (...args: unknown[]) => void;
declare global {
  interface Window {
    gtag?: Gtag;
  }
}

export function track(event: AnalyticsEvent): void {
  if (typeof window === 'undefined' || !analyticsAllowed()) return;
  const ga = GA4_EVENT[event.name];
  if (ga) window.gtag?.('event', ga, { ...COMMON_PROPS, ...event.props });
  if (event.name === 'Page Viewed') window.gtag?.('event', 'page_view', { ...COMMON_PROPS, ...event.props });
  if (!analyticsEnabled) return;
  amplitude.track(event.name, event.props ?? {});
}

/** 같은 탭 세션에서 한 번만 보낸다 (새로고침·뒤로가기로 중복되는 노출 이벤트용). */
export function trackOncePerSession(event: AnalyticsEvent, key: string = event.name): void {
  if (typeof window === 'undefined' || !analyticsAllowed()) return;
  const k = `sc_tracked:${key}`;
  try {
    if (sessionStorage.getItem(k)) return;
    sessionStorage.setItem(k, '1');
  } catch {
    // 저장소가 막혀 있으면 중복을 감수하고 보낸다
  }
  track(event);
}

// ─── 첫 유입 (first touch) ───────────────────────────────────────────────────
// 처음 들어온 utm·랜딩·referrer 를 기억해 두었다가 가입할 때 유저 속성으로 한 번만(setOnce) 붙인다.
// 로그아웃(reset)하면 지운다 — 같은 브라우저의 다음 사람에게 앞사람 유입이 붙지 않게.

const FIRST_TOUCH_KEY = 'sc_first_touch';
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;

export function captureFirstTouch(): void {
  if (typeof window === 'undefined' || !analyticsAllowed()) return;
  try {
    if (localStorage.getItem(FIRST_TOUCH_KEY)) return;
    const qs = new URLSearchParams(window.location.search);
    const touch: Record<string, string> = { acquisition_landing_path: window.location.pathname };
    for (const k of UTM_KEYS) {
      const v = qs.get(k);
      if (v) touch[`acquisition_${k.slice(4)}`] = v.toLowerCase();
    }
    if (document.referrer) {
      const host = new URL(document.referrer).hostname;
      if (host !== window.location.hostname) touch.acquisition_referrer_host = host;
    }
    localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(touch));
  } catch {
    // 저장소가 막혀 있으면 첫 유입 없이 간다
  }
}

function readFirstTouch(): Record<string, string> {
  try {
    return z.record(z.string(), z.string()).parse(JSON.parse(localStorage.getItem(FIRST_TOUCH_KEY) ?? '{}'));
  } catch {
    return {};
  }
}

export function clearFirstTouch(): void {
  try {
    localStorage.removeItem(FIRST_TOUCH_KEY);
  } catch {
    // 무시
  }
}

/** GA4 client_id — `_ga` 쿠키 `GA1.1.<a>.<b>` 의 `<a>.<b>`. 없으면 undefined (서버가 합성 id 로 보낸다). */
export function readGaClientId(
  cookie: string = typeof document === 'undefined' ? '' : document.cookie,
): string | undefined {
  if (!analyticsAllowed()) return undefined;
  if (analyticsClientId()) return analyticsClientId();
  return /(?:^|;\s*)_ga=GA\d+\.\d+\.(\d+\.\d+)/.exec(cookie)?.[1];
}

/** 가입 완료 지점 — 첫 유입을 유저 속성에 setOnce 로 남기고 `User Signed Up` 을 보낸다. */
export function trackSignUp(method: 'google' | 'apple' = 'google'): void {
  if (typeof window === 'undefined' || !analyticsAllowed()) return;
  if (analyticsEnabled) {
    const identifyObj = new amplitude.Identify();
    for (const [k, v] of Object.entries(readFirstTouch())) identifyObj.setOnce(k, v);
    amplitude.identify(identifyObj);
  }
  track({ name: 'User Signed Up', props: { method, signup_surface: 'onboarding' } });
}

export function identifyUser(properties: Partial<UserProperties>): void {
  if (typeof window === 'undefined' || !analyticsEnabled || !analyticsAllowed()) return;
  const identifyObj = new amplitude.Identify();
  (Object.entries(properties) as [string, string | number | boolean][]).forEach(([key, value]) => {
    if (value !== undefined) identifyObj.set(key, value);
  });
  amplitude.identify(identifyObj);
}

/**
 * Amplitude 세션 회원을 서버가 내려준 HMAC 분석 ID로 맞춘다. Clarity는 lib/clarity가 담당한다.
 * 로그아웃하면 reset() 으로 기기 id 까지 새로 받아, 같은 브라우저의 다음 사람과 이어지지 않게 한다.
 */
export function syncAnalyticsUser(
  user: { id: number; timeZone?: string | null; onboardingCompletedAt?: string | null } | null,
): void {
  if (typeof window === 'undefined') return;
  if (!analyticsEnabled) return;
  if (!analyticsAllowed()) {
    amplitude.setOptOut(true);
    return;
  }
  if (!user) {
    if (amplitude.getUserId()) {
      amplitude.reset();
      clearFirstTouch();
    }
    return;
  }
  const userId = analyticsUserId();
  if (!userId) return;
  if (amplitude.getUserId() !== userId) amplitude.setUserId(userId);
  identifyUser({
    is_onboarding_complete: Boolean(user.onboardingCompletedAt),
    ...(user.timeZone ? { user_region: user.timeZone } : {}),
  });
}
