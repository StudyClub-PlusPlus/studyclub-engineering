package com.studyclub.api.feedback;

import com.studyclub.domain.feedback.FeedbackSubmitterStatus;
import com.studyclub.domain.feedback.FeedbackType;
import java.time.Instant;
import java.util.List;

/**
 * 내 문의 상세 (specs/feedback/spec.md). 캡틴 전용 메모 · 제출 환경 · 완료 처리자는 내보내지 않는다.
 *
 * @param reply 회신 전이면 null — 화면은 「답변을 준비하고 있어요」
 */
public record MyFeedbackDetailResponse(
        Long id,
        FeedbackType type,
        String title,
        String content,
        FeedbackSubmitterStatus status,
        Instant createdAt,
        List<FeedbackImageUrl> images,
        FeedbackReply reply) {}
