package com.studyclub.domain.event.registration;

import static com.studyclub.domain.event.EventInputs.invalid;

import com.studyclub.common.validation.EmailFormat;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.event.ChannelSeats;
import com.studyclub.domain.event.ClubEvent;
import com.studyclub.domain.event.ClubEventQuestion;
import com.studyclub.domain.event.EventDisplayStatus;
import com.studyclub.domain.event.EventInputs;
import com.studyclub.domain.event.EventQuestionType;
import com.studyclub.domain.event.EventSeatCounts;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 크루가 행사에 신청할 수 있나 · 보낸 답이 맞나 — 행사 · 계정 · 신청 이력 세 애그리거트를 함께 보는 판정이라 엔티티 하나에 두지 않는다
 * (specs/event-registration 「신청할 수 있나」 · 「신청 제출」). 상세와 신청 제출이 이 한 곳을 쓴다.
 */
public final class ClubEventApplication {

    /** 단답 · 장문 글자 수 (R3, 스터디 신청과 같다). UTF-16 길이, 앞뒤 공백을 지운 뒤. */
    public static final int TEXT_MAX = 200;

    public static final int TEXTAREA_MAX = 2000;

    private ClubEventApplication() {}

    /**
     * 위에서부터 먼저 맞는 것 하나. 신청할 수 있으면 null.
     *
     * @param applicant 토큰의 계정. 비로그인 · 계정 없음(탈퇴)이면 null
     * @param myRegistrations 이 행사의 내 신청 전부 (비로그인이면 빈 목록)
     */
    public static ApplyBlockedReason blockedReason(
            ClubEvent event,
            Instant now,
            EventSeatCounts counts,
            Account applicant,
            List<ClubEventRegistration> myRegistrations) {
        if (applicant == null) {
            return ApplyBlockedReason.LOGIN_REQUIRED;
        }
        if (applicant.getOnboardingCompletedAt() == null) {
            return ApplyBlockedReason.ONBOARDING_REQUIRED;
        }
        ApplyBlockedReason byEvent = eventBlockedReason(event, now);
        if (byEvent != null) {
            return byEvent;
        }
        if (!EmailFormat.isValid(applicant.getEmail())) {
            return ApplyBlockedReason.ACCOUNT_EMAIL_INVALID;
        }
        if (myRegistrations.stream().anyMatch(ClubEventRegistration::isActive)) {
            return ApplyBlockedReason.ALREADY_REGISTERED;
        }
        if (myRegistrations.stream()
                .anyMatch(r -> r.getStatus() == ClubEventRegistrationStatus.DECLINED)) {
            return ApplyBlockedReason.DECLINED_BEFORE;
        }
        if (event.seats(counts).stream().allMatch(ChannelSeats::isFull)) {
            return ApplyBlockedReason.FULL;
        }
        return null;
    }

    // 3 ~ 5 — displayStatus 와 같은 재료 (취소 > 종료 > 모집 마감)
    private static ApplyBlockedReason eventBlockedReason(ClubEvent event, Instant now) {
        EventDisplayStatus display = event.displayStatus(now, EventSeatCounts.none());
        return switch (display) {
            case CANCELLED -> ApplyBlockedReason.EVENT_CANCELLED;
            case ENDED -> ApplyBlockedReason.EVENT_ENDED;
            case RECRUITMENT_CLOSED -> ApplyBlockedReason.RECRUITMENT_CLOSED;
            case FULL, RECRUITING -> null;
        };
    }

    /**
     * 답 검증 · 정리 (처리 순서 12). 현재 질문에 없는 키 · 선택지에 없는 값 · 필수 미응답 · 글자 수는 400 {@code
     * answers.{questionId}}. 글은 앞뒤 공백을 지우고(줄바꿈은 안쪽이면 남는다), 빈 답은 뺀다. 돌려주는 맵은 질문 표시 순서다.
     */
    public static Map<String, List<String>> normalizeAnswers(
            List<ClubEventQuestion> questions, Map<String, List<String>> answers) {
        Map<String, List<String>> received = answers == null ? Map.of() : answers;
        Set<String> known = new HashSet<>();
        for (ClubEventQuestion question : questions) {
            known.add(question.getQuestionKey());
        }
        for (String key : received.keySet()) {
            if (!known.contains(key)) {
                throw invalid("answers." + key, "현재 신청 질문에 없는 질문입니다.");
            }
        }
        Map<String, List<String>> normalized = new LinkedHashMap<>();
        for (ClubEventQuestion question : questions) {
            String field = "answers." + question.getQuestionKey();
            List<String> values =
                    normalizeOne(question, received.get(question.getQuestionKey()), field);
            if (values.isEmpty()) {
                if (question.isRequired()) {
                    throw invalid(field, "「" + question.getLabel() + "」에 답변해 주세요.");
                }
                continue;
            }
            normalized.put(question.getQuestionKey(), values);
        }
        return normalized;
    }

    private static List<String> normalizeOne(
            ClubEventQuestion question, List<String> values, String field) {
        if (values == null) {
            return List.of();
        }
        if (values.stream().anyMatch(v -> v == null)) {
            throw invalid(field, "답은 문자열 배열로 보내 주세요.");
        }
        EventQuestionType type = question.getType();
        return switch (type) {
            case TEXT, TEXTAREA -> {
                if (values.size() > 1) {
                    throw invalid(field, "답은 하나만 보낼 수 있습니다.");
                }
                String text = values.isEmpty() ? "" : EventInputs.trim(values.get(0));
                if (text.isEmpty()) {
                    yield List.of();
                }
                int max = type == EventQuestionType.TEXT ? TEXT_MAX : TEXTAREA_MAX;
                if (text.length() > max) {
                    throw invalid(field, "1~" + max + "자로 입력해 주세요.");
                }
                yield List.of(text);
            }
            case RADIO -> {
                if (values.size() > 1) {
                    throw invalid(field, "하나만 고를 수 있습니다.");
                }
                values.forEach(v -> requireOption(question, v, field));
                yield List.copyOf(values);
            }
            case CHECKBOX -> {
                List<String> picked = new ArrayList<>();
                for (String value : values) {
                    requireOption(question, value, field);
                    if (picked.contains(value)) {
                        throw invalid(field, "같은 선택지를 두 번 고를 수 없습니다.");
                    }
                    picked.add(value);
                }
                yield List.copyOf(picked);
            }
        };
    }

    private static void requireOption(ClubEventQuestion question, String value, String field) {
        if (!question.getOptions().contains(value)) {
            throw invalid(field, "선택지에 없는 값입니다.");
        }
    }
}
