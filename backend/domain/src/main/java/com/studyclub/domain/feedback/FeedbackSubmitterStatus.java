package com.studyclub.domain.feedback;

/**
 * 제출자(내 문의)가 보는 상태 — 접수 · 답변 완료. 운영 단계(미확인 · 확인)는 제출자에게 보이지 않는다. 값은 {@link
 * Feedback#submitterStatus()} 한 곳에서 낸다.
 */
public enum FeedbackSubmitterStatus {
    RECEIVED,
    ANSWERED
}
