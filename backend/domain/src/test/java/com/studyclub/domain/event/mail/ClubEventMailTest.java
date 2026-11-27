package com.studyclub.domain.event.mail;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.domain.event.EventChannel;
import com.studyclub.domain.event.EventStatus;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ClubEventMailTest {

    private static final ClubEventMailType ANNOUNCEMENT = ClubEventMailType.ANNOUNCEMENT;
    private static final ClubEventMailType CANCELLATION = ClubEventMailType.CANCELLATION;

    @Test
    @DisplayName("sendBlock — 취소 여부 → 템플릿 → 받는 사람 → 안내 내용 순으로 첫 이유 하나")
    void order() {
        assertThat(ClubEventMail.sendBlock(EventStatus.CANCELLED, ANNOUNCEMENT, false, 0, ""))
                .isEqualTo(MailBlockedReason.EVENT_CANCELLED);
        assertThat(ClubEventMail.sendBlock(EventStatus.PUBLISHED, CANCELLATION, false, 0, ""))
                .isEqualTo(MailBlockedReason.EVENT_NOT_CANCELLED);
        assertThat(ClubEventMail.sendBlock(EventStatus.PUBLISHED, ANNOUNCEMENT, false, 0, ""))
                .isEqualTo(MailBlockedReason.TEMPLATE_MISSING);
        assertThat(ClubEventMail.sendBlock(EventStatus.PUBLISHED, ANNOUNCEMENT, true, 0, ""))
                .isEqualTo(MailBlockedReason.NO_RECIPIENTS);
        assertThat(ClubEventMail.sendBlock(EventStatus.PUBLISHED, ANNOUNCEMENT, true, 3, " \n "))
                .isEqualTo(MailBlockedReason.NOTICE_REQUIRED);
        assertThat(ClubEventMail.sendBlock(EventStatus.PUBLISHED, ANNOUNCEMENT, true, 3, null))
                .isEqualTo(MailBlockedReason.NOTICE_REQUIRED);
        assertThat(ClubEventMail.sendBlock(EventStatus.CANCELLED, CANCELLATION, true, 3, "취소"))
                .isNull();
    }

    @Test
    @DisplayName("sendBlock — 모집 마감 행사 · 종료된 행사(상태로는 PUBLISHED)도 막지 않는다 (M4)")
    void endedIsAllowed() {
        assertThat(ClubEventMail.sendBlock(EventStatus.CLOSED, ANNOUNCEMENT, true, 1, "안내"))
                .isNull();
        assertThat(ClubEventMail.sendBlock(EventStatus.PUBLISHED, ANNOUNCEMENT, true, 1, "안내"))
                .isNull();
    }

    @Test
    @DisplayName("send — 같은 계정은 한 번만 남기고 받는 사람 수는 남긴 수, 계정 ID 순")
    void send() {
        ClubEventMail mail =
                ClubEventMail.send(
                        10L,
                        ANNOUNCEMENT,
                        ClubEventMailAudience.ALL,
                        new ClubEventMail.Rendered(3L, "제목", "<p>본문</p>", ClubEventMailFormat.HTML),
                        "안내",
                        "Asia/Seoul",
                        List.of(
                                new ClubEventMail.Recipient(30L, 301L, EventChannel.ONLINE),
                                new ClubEventMail.Recipient(20L, 201L, EventChannel.OFFLINE),
                                new ClubEventMail.Recipient(30L, 302L, EventChannel.ONLINE)),
                        7L,
                        "key");

        assertThat(mail.getRecipientCount()).isEqualTo(2);
        assertThat(mail.getRecipients())
                .extracting(ClubEventMailRecipient::getAccountId)
                .containsExactly(20L, 30L);
        assertThat(mail.getTemplateId()).isEqualTo(3L);
    }

    @Test
    @DisplayName("대상과 종류 — 안내는 ALL · ONLINE · OFFLINE, 취소 안내는 CANCELLED_ACTIVE 만")
    void audience() {
        assertThat(ClubEventMailAudience.ALL.allowedFor(ANNOUNCEMENT)).isTrue();
        assertThat(ClubEventMailAudience.OFFLINE.allowedFor(ANNOUNCEMENT)).isTrue();
        assertThat(ClubEventMailAudience.CANCELLED_ACTIVE.allowedFor(ANNOUNCEMENT)).isFalse();
        assertThat(ClubEventMailAudience.CANCELLED_ACTIVE.allowedFor(CANCELLATION)).isTrue();
        assertThat(ClubEventMailAudience.ALL.allowedFor(CANCELLATION)).isFalse();
    }
}
