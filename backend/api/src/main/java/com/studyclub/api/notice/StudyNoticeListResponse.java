package com.studyclub.api.notice;

import com.studyclub.domain.notice.DiscordDeliveryStatus;
import com.studyclub.domain.notice.DiscordSkipReason;
import java.time.Instant;
import java.util.List;

/** 보낸 공지 기록. 프로젝트 응답 계약({@code items/total/offset/limit}) 그대로다. */
public record StudyNoticeListResponse(List<Item> items, long total, int offset, int limit) {

    /**
     * @param senderName 보낸 사람 닉네임. 탈퇴했으면 「탈퇴한 회원」
     * @param recipientCount 받는 사람 수
     */
    public record Item(
            Long noticeId,
            String title,
            String body,
            String senderName,
            Instant sentAt,
            int recipientCount,
            Email email,
            Discord discord) {}

    /**
     * 받는 사람 수 기준이다. 대기는 {@code PENDING}·{@code PROCESSING}, 탈퇴로 취소된 건({@code CANCELLED})은 세지 않는다.
     * 메일을 안 골랐으면 모두 0.
     */
    public record Email(boolean requested, long pending, long sent, long failed) {}

    /**
     * @param mentionedCount 멘션된 사람 수 — 보내지 않았거나 건너뛰었으면 0
     */
    public record Discord(
            boolean requested,
            DiscordDeliveryStatus status,
            DiscordSkipReason skipReason,
            long mentionedCount) {}
}
