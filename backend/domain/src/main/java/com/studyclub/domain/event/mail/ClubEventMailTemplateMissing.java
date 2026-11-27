package com.studyclub.domain.event.mail;

import com.studyclub.common.event.DomainEvent;
import com.studyclub.common.event.EventMeta;
import java.util.List;

/**
 * 자동 메일 템플릿이 없어 처리 한 번에서 바뀐 신청들의 메일을 건너뛰었다 (specs/event-mail 「템플릿이 없을 때 (M2)」). 처리는 그대로 커밋된다. 운영 채널
 * 경보 구독자가 받는다 — 메일 행을 만드는 notification 모듈은 경보 발송기를 모르기 때문에 사실로 넘긴다.
 *
 * @param eventType 알림 조건 이름 ({@code EVENT_REGISTRATION_*})
 * @param registrationIds 메일을 건너뛴 신청 — 종료 자동 전환이면 여러 건이다
 */
public record ClubEventMailTemplateMissing(
        EventMeta meta, String eventType, Long clubEventId, List<Long> registrationIds)
        implements DomainEvent {

    public static final String NAME = "club_event_mail.template_missing";

    public ClubEventMailTemplateMissing {
        registrationIds = List.copyOf(registrationIds);
    }

    public static ClubEventMailTemplateMissing of(
            String eventType, Long clubEventId, List<Long> registrationIds) {
        return new ClubEventMailTemplateMissing(
                EventMeta.now(null), eventType, clubEventId, registrationIds);
    }

    @Override
    public String name() {
        return NAME;
    }

    @Override
    public String aggregateType() {
        return "club_event";
    }

    @Override
    public String aggregateId() {
        return String.valueOf(clubEventId);
    }
}
