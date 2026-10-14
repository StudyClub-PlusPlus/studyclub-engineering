import type { StudyStatus } from '@studyclub/mock';

import { amplitude, analyticsEnabled } from '@/lib/amplitude';

// ─── Shared shapes ────────────────────────────────────────────────────────────

type StudyBaseProps = {
  study_id: string;
  study_title_ko: string;
  study_category?: string;
  study_status?: StudyStatus;
};

type BookmarkSource = 'card_landing' | 'card_list' | 'detail' | 'my_page';

// ─── Page name enum ───────────────────────────────────────────────────────────

export type PageName =
  'landing' | 'studies_list' | 'study_detail' | 'events_list' | 'event_detail' | 'login' | 'onboarding' | 'my_page';

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
  | { name: 'Auth OAuth Cancelled'; props: { error: string } }
  | { name: 'Auth Login Completed'; props: { is_new_user: boolean; next_path: string } }
  | { name: 'Auth Login Failed'; props: { error_message: string; http_status: number } }

  // ── Onboarding ───────────────────────────────────────────────────────────────
  | { name: 'Onboarding Started'; props: { suggested_nickname: boolean } }
  | { name: 'Onboarding Nickname Submitted'; props: { used_suggested_name: boolean; nickname_length: number } }
  | { name: 'Onboarding Nickname Conflict'; props: { attempt_count: number } }
  | {
      name: 'Onboarding Consents Agreed';
      props: { terms_agreed: boolean; privacy_agreed: boolean; marketing_agreed: boolean };
    }
  | { name: 'Onboarding Completed'; props: { time_to_complete_sec: number; marketing_agreed: boolean } }

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
  | { name: 'Study Bookmarked'; props: StudyBaseProps & { source: BookmarkSource } }
  | { name: 'Study Unbookmarked'; props: StudyBaseProps & { source: BookmarkSource } }
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

  // ── My page ──────────────────────────────────────────────────────────────────
  | { name: 'My Application Cancelled'; props: { study_id: string; applied_at: string; days_since_apply: number } }
  | { name: 'My Discord Connected'; props?: Record<string, never> }
  | { name: 'My Profile Updated'; props: { changed_fields: string[]; new_region: string } };

// ─── User properties ─────────────────────────────────────────────────────────

export type UserProperties = {
  user_locale: 'ko' | 'en';
  user_region: string;
  is_onboarding_complete: boolean;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function track(event: AnalyticsEvent): void {
  if (typeof window === 'undefined' || !analyticsEnabled) return;
  amplitude.track(event.name, event.props ?? {});
}

export function identifyUser(properties: Partial<UserProperties>): void {
  if (typeof window === 'undefined' || !analyticsEnabled) return;
  const identifyObj = new amplitude.Identify();
  (Object.entries(properties) as [string, string | number | boolean][]).forEach(([key, value]) => {
    if (value !== undefined) identifyObj.set(key, value);
  });
  amplitude.identify(identifyObj);
}

/**
 * 세션 회원을 Amplitude user_id 로 맞춘다. 이메일·이름은 보내지 않는다 — 회원 번호만.
 * 로그아웃하면 reset() 으로 기기 id 까지 새로 받아, 같은 브라우저의 다음 사람과 이어지지 않게 한다.
 */
export function syncAnalyticsUser(
  user: { id: number; timeZone?: string | null; onboardingCompletedAt?: string | null } | null,
): void {
  if (typeof window === 'undefined' || !analyticsEnabled) return;
  if (!user) {
    if (amplitude.getUserId()) amplitude.reset();
    return;
  }
  const userId = String(user.id);
  if (amplitude.getUserId() !== userId) amplitude.setUserId(userId);
  identifyUser({
    is_onboarding_complete: Boolean(user.onboardingCompletedAt),
    ...(user.timeZone ? { user_region: user.timeZone } : {}),
  });
}
