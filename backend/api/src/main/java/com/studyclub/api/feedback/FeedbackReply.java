package com.studyclub.api.feedback;

import com.studyclub.domain.feedback.Feedback;
import java.time.Instant;

/**
 * 캡틴 회신. 내 문의 상세와 운영 상세가 같이 쓴다.
 *
 * @param repliedAt 처음 보낸 시각 — 회신을 고쳐도 그대로다
 */
public record FeedbackReply(String content, Instant repliedAt) {

    /** 회신 전이면 null. */
    static FeedbackReply of(Feedback feedback) {
        return feedback.isAnswered()
                ? new FeedbackReply(feedback.getReplyContent(), feedback.getRepliedAt())
                : null;
    }
}
