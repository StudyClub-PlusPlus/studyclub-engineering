package com.studyclub.domain.event.mail;

import com.studyclub.common.event.DomainEvent;
import com.studyclub.common.event.EventMeta;

/**
 * 운영자가 행사 안내 · 취소 안내 메일을 보냈다 ({@code EVENT_MAIL} 저장). 보내기 트랜잭션 안에서 발행한다. 제목 · 본문 · 안내 내용 · 주소는 싣지
 * 않는다.
 *
 * <p>구독자: {@code ClubEventMailEmailListener} (notification, {@code BEFORE_COMMIT}) 가 받는 사람마다 메일 행을
 * 같은 트랜잭션에 만든다.
 */
public record ClubEventMailSentEvent(
        EventMeta meta, Long mailId, Long clubEventId, ClubEventMailType type, int recipientCount)
        implements DomainEvent {

    public static final String NAME = "club_event_mail.sent";

    /** 행위자 = 보낸 캡틴. */
    public static ClubEventMailSentEvent of(ClubEventMail mail) {
        return new ClubEventMailSentEvent(
                EventMeta.now(mail.getSenderAccountId()),
                mail.getId(),
                mail.getClubEventId(),
                mail.getType(),
                mail.getRecipientCount());
    }

    @Override
    public String name() {
        return NAME;
    }

    @Override
    public String aggregateType() {
        return "club_event_mail";
    }

    @Override
    public String aggregateId() {
        return String.valueOf(mailId);
    }
}
