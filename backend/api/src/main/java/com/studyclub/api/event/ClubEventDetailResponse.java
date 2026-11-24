package com.studyclub.api.event;

import com.studyclub.domain.event.EventChannel;
import com.studyclub.domain.event.EventConfirmation;
import com.studyclub.domain.event.EventDisplayStatus;
import com.studyclub.domain.event.EventFormat;
import com.studyclub.domain.event.EventQuestionType;
import com.studyclub.domain.event.registration.ApplyBlockedReason;
import com.studyclub.domain.event.registration.ClubEventRegistrationStatus;
import com.studyclub.domain.event.registration.SelfCancelBlockedReason;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * 사이트 행사 상세 (specs/event-registration 「행사 상세」). 확인 대기 · 참가 확정 수는 싣지 않고 잔여석만 싣는다. 온라인 링크는 참가 확정된 온라인
 * 신청자의 {@code myRegistration.onlineUrl} 에만 있다.
 *
 * @param online 온라인 방식이 있으면 빈 객체 {@code {}}, 없으면 null — 링크가 있는지조차 알리지 않는다
 */
public record ClubEventDetailResponse(
        Long eventId,
        String title,
        String summary,
        String description,
        String timeZone,
        Instant startsAt,
        Instant endsAt,
        Instant effectiveEndsAt,
        Instant deadlineAt,
        EventFormat format,
        Offline offline,
        Map<String, Object> online,
        EventConfirmation confirmation,
        EventDisplayStatus displayStatus,
        List<Seat> seats,
        List<Question> questions,
        String questionVersion,
        boolean canApply,
        ApplyBlockedReason applyBlockedReason,
        MyRegistration myRegistration) {

    public record Offline(String location) {}

    public record Seat(EventChannel channel, int capacity, int remaining) {}

    public record Question(
            String questionId,
            String label,
            EventQuestionType type,
            boolean required,
            List<String> options) {}

    /** 이 행사의 내 최신 신청. {@code onlineUrl} 은 {@code onlineLinkVisible} 일 때만 값이 있다 (미입력이면 null). */
    public record MyRegistration(
            Long registrationId,
            ClubEventRegistrationStatus status,
            EventChannel channel,
            Instant createdAt,
            boolean canCancel,
            SelfCancelBlockedReason cancelBlockedReason,
            boolean onlineLinkVisible,
            String onlineUrl) {}
}
