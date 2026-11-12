package com.studyclub.domain.notice;

import com.studyclub.common.event.DomainEvent;
import com.studyclub.common.event.EventMeta;

/**
 * 네비게이터(담당 캡틴)가 반 공지를 보냈다. 공지를 저장하는 트랜잭션 안에서 한 건 발행한다 (specs/domain-events/spec.md).
 *
 * <p>구독자는 둘이다. 메일 아웃박스 행은 공지와 같은 트랜잭션에 만들어야 해서 {@code BEFORE_COMMIT} 으로 받고, 디스코드는 커밋 뒤 비동기로 받는다.
 * 제목·본문·주소는 싣지 않는다 — 구독자가 {@code noticeId} 로 읽는다.
 */
public record StudyNoticeSent(
        EventMeta meta,
        Long noticeId,
        Long studyId,
        Long studyGroupId,
        Long senderAccountId,
        boolean sendEmail,
        boolean sendDiscord,
        int recipientCount)
        implements DomainEvent {

    public static final String NAME = "study_notice.sent";

    /** 행위자 = 보낸 사람. */
    public static StudyNoticeSent of(StudyNotice notice) {
        return new StudyNoticeSent(
                EventMeta.now(notice.getSenderAccountId()),
                notice.getId(),
                notice.getStudyId(),
                notice.getStudyGroupId(),
                notice.getSenderAccountId(),
                notice.isSendEmail(),
                notice.isSendDiscord(),
                notice.getRecipients().size());
    }

    @Override
    public String name() {
        return NAME;
    }

    @Override
    public String aggregateType() {
        return "study_notice";
    }

    @Override
    public String aggregateId() {
        return String.valueOf(noticeId);
    }
}
