package com.studyclub.api.event;

import com.studyclub.domain.event.ClubEvent;
import com.studyclub.domain.event.EventChannel;
import com.studyclub.domain.event.EventQuestionType;
import com.studyclub.domain.event.registration.ClubEventRegistration;
import com.studyclub.domain.event.registration.ClubEventRegistrationStatus;
import com.studyclub.domain.event.registration.SelfCancelBlockedReason;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * 내 신청서 — 신청 한 건과 신청 당시 질문 · 답 (specs/event-registration 「내 신청서」). 신청 제출(201) · 본인 취소(200)도 같은
 * 모양이다. 현재 질문을 조인해 다시 그리지 않는다. 온라인 링크는 싣지 않는다.
 */
public record ClubEventRegistrationFormResponse(
        Long registrationId,
        Long eventId,
        ClubEventRegistrationStatus status,
        EventChannel channel,
        Instant createdAt,
        boolean canCancel,
        SelfCancelBlockedReason cancelBlockedReason,
        List<Question> questions) {

    /** 신청 당시 질문 하나와 그 답. 답하지 않은 선택 질문은 {@code answer = []}. */
    public record Question(
            String questionId,
            String label,
            EventQuestionType type,
            boolean required,
            List<String> options,
            List<String> answer) {}

    static ClubEventRegistrationFormResponse of(
            ClubEventRegistration registration, ClubEvent event, Instant now) {
        SelfCancelBlockedReason blocked = registration.selfCancelBlockedReason(event, now);
        Map<String, List<String>> answers = registration.getAnswersSnapshot();
        return new ClubEventRegistrationFormResponse(
                registration.getId(),
                registration.getClubEventId(),
                registration.getStatus(),
                registration.getChannel(),
                registration.getCreatedAt(),
                blocked == null,
                blocked,
                registration.getQuestionsSnapshot().stream()
                        .map(
                                q ->
                                        new Question(
                                                q.questionId(),
                                                q.label(),
                                                q.type(),
                                                q.required(),
                                                q.options(),
                                                answers.getOrDefault(q.questionId(), List.of())))
                        .toList());
    }
}
