package com.studyclub.api.feedback;

import com.studyclub.domain.feedback.Feedback;
import com.studyclub.domain.feedback.FeedbackSubmitterStatus;
import com.studyclub.domain.feedback.FeedbackType;
import java.time.Instant;

/**
 * 내 문의 목록의 한 줄. 제출 응답(201)도 이 모양이다 — 화면이 다시 조회하지 않고 목록 맨 위에 넣는다.
 *
 * @param status 제출자에게 보이는 상태(접수 · 답변 완료). 운영 단계는 내보내지 않는다
 */
public record MyFeedbackItem(
        Long id,
        FeedbackType type,
        String title,
        FeedbackSubmitterStatus status,
        Instant createdAt) {

    static MyFeedbackItem from(Feedback feedback) {
        return new MyFeedbackItem(
                feedback.getId(),
                feedback.getType(),
                feedback.getTitle(),
                feedback.submitterStatus(),
                feedback.getCreatedAt());
    }
}
