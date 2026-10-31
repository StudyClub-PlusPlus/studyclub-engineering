package com.studyclub.domain.feedback;

/** 운영 콘솔이 보는 처리 상태 — 미확인 · 확인 · 완료. {@code DONE} 은 첫 회신으로만 된다 ({@link Feedback#reply}). */
public enum FeedbackStatus {
    NEW,
    SEEN,
    DONE
}
