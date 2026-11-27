package com.studyclub.domain.event.registration;

import com.studyclub.domain.event.ClubEvent;
import com.studyclub.domain.event.ClubEventQuestion;
import com.studyclub.domain.event.EventQuestionType;
import java.util.List;

/**
 * 신청 당시 질문 한 개의 사본 — {@code QUESTIONS_SNAPSHOT} JSON 배열의 원소. 캡틴이 질문을 고치거나 지워도 기존 신청서는 이 사본으로 그린다
 * (specs/event/spec.md 「신청 질문의 보존」).
 *
 * @param questionId 행사 안의 안정 키 ({@code CLUB_EVENT_QUESTION.QUESTION_KEY}). 답 맵의 키와 같다
 */
public record RegistrationQuestion(
        String questionId,
        String label,
        EventQuestionType type,
        boolean required,
        List<String> options) {

    public RegistrationQuestion {
        options = List.copyOf(options);
    }

    public static RegistrationQuestion from(ClubEventQuestion question) {
        return new RegistrationQuestion(
                question.getQuestionKey(),
                question.getLabel(),
                question.getType(),
                question.isRequired(),
                question.getOptions());
    }

    /** 행사의 현재 질문 전체를 표시 순서대로 사본으로. 질문이 없으면 빈 목록. */
    public static List<RegistrationQuestion> snapshotOf(ClubEvent event) {
        return event.getQuestions().stream().map(RegistrationQuestion::from).toList();
    }
}
