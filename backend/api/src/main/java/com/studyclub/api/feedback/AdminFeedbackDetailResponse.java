package com.studyclub.api.feedback;

import com.studyclub.api.feedback.AdminFeedbackListResponse.Person;
import com.studyclub.domain.feedback.FeedbackStatus;
import com.studyclub.domain.feedback.FeedbackType;
import java.time.Instant;
import java.util.List;

/**
 * 운영 콘솔의 문의·오류 신고 상세 (specs/feedback/spec.md). 처리(PATCH) 응답도 이 모양이다 — 화면이 다시 조회하지 않고 갱신한다.
 *
 * @param selectableStatuses 상태 드롭다운에서 지금 고를 수 있는 값. 회신 전 {@code [NEW, SEEN]}, 회신 뒤 빈 목록
 * @param browser 「Chrome 141 · macOS」. 모르면 null
 * @param viewport 화면이 안 보냈으면 null
 * @param reply 회신 전이면 null
 */
public record AdminFeedbackDetailResponse(
        Long id,
        Instant createdAt,
        FeedbackType type,
        String title,
        Person submitter,
        FeedbackStatus status,
        Person doneBy,
        List<FeedbackStatus> selectableStatuses,
        String content,
        List<FeedbackImageUrl> images,
        String browser,
        Viewport viewport,
        FeedbackReply reply,
        String adminMemo) {

    public record Viewport(int width, int height) {}
}
