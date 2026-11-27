package com.studyclub.api.event;

import com.studyclub.domain.account.Account;
import com.studyclub.domain.event.EventChannel;
import com.studyclub.domain.event.EventQuestionType;
import com.studyclub.domain.event.registration.ClubEventRegistration;
import com.studyclub.domain.event.registration.ClubEventRegistrationStatus;
import com.studyclub.domain.event.registration.RegistrationQuestion;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/** 신청서 — 신청 당시 질문 사본 순서대로, 답을 질문 안에 맞춰 넣는다. 현재 행사 질문은 읽지 않는다. */
public record AdminClubEventRegistrationDetailResponse(
        Long registrationId,
        String nickname,
        boolean accountDeleted,
        EventChannel channel,
        ClubEventRegistrationStatus status,
        Instant createdAt,
        List<Question> questions) {

    /** {@code answer} 는 언제나 배열이다. 답하지 않은 질문은 빈 배열. */
    public record Question(
            String questionId,
            String label,
            EventQuestionType type,
            boolean required,
            List<String> options,
            List<String> answer) {}

    static AdminClubEventRegistrationDetailResponse of(
            ClubEventRegistration registration, Account account) {
        Map<String, List<String>> answers = registration.getAnswersSnapshot();
        List<Question> questions =
                registration.getQuestionsSnapshot().stream()
                        .map(question -> question(question, answers))
                        .toList();
        return new AdminClubEventRegistrationDetailResponse(
                registration.getId(),
                account == null ? null : account.getNickname(),
                account == null,
                registration.getChannel(),
                registration.getStatus(),
                registration.getCreatedAt(),
                questions);
    }

    private static Question question(
            RegistrationQuestion question, Map<String, List<String>> answers) {
        return new Question(
                question.questionId(),
                question.label(),
                question.type(),
                question.required(),
                question.options(),
                List.copyOf(answers.getOrDefault(question.questionId(), List.of())));
    }
}
