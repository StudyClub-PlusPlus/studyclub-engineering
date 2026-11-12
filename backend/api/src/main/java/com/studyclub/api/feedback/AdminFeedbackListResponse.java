package com.studyclub.api.feedback;

import com.studyclub.domain.feedback.FeedbackStatus;
import com.studyclub.domain.feedback.FeedbackType;
import java.time.Instant;
import java.util.List;

/** 운영 콘솔의 문의·오류 신고 목록 (specs/feedback/spec.md). {@code total} 은 걸러진 뒤 전체 수. */
public record AdminFeedbackListResponse(
        List<FeedbackSummary> items, long total, int offset, int limit) {

    /**
     * @param submitter 제출자. 늘 있다 — 로그인해야 보낸다
     * @param doneBy 완료 처리자(첫 회신을 보낸 캡틴). 완료가 아니면 null
     */
    public record FeedbackSummary(
            Long id,
            Instant createdAt,
            FeedbackType type,
            String title,
            Person submitter,
            FeedbackStatus status,
            Person doneBy) {}

    /**
     * @param nickname 탈퇴했으면 null — 화면은 「탈퇴한 사용자」
     */
    public record Person(String nickname) {}
}
