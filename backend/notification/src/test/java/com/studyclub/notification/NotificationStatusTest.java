package com.studyclub.notification;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/** 받는 사람 한 명의 메일 행들을 대표 상태 하나로 줄이는 규칙 — 공지별 메일 건수(받는 사람 수 기준)의 재료. */
class NotificationStatusTest {

    private static Optional<NotificationStatus> representative(NotificationStatus... statuses) {
        return NotificationStatus.representative(List.of(statuses));
    }

    @Test
    @DisplayName("하나라도 FAILED 면 FAILED — 대기·완료가 섞여 있어도 실패가 먼저 눈에 띄어야 한다")
    void failedWins() {
        assertThat(representative(NotificationStatus.SENT, NotificationStatus.FAILED))
                .contains(NotificationStatus.FAILED);
        assertThat(representative(NotificationStatus.PENDING, NotificationStatus.FAILED))
                .contains(NotificationStatus.FAILED);
    }

    @Test
    @DisplayName("FAILED 가 없고 하나라도 PENDING·PROCESSING 이면 PENDING")
    void pendingBeatsSent() {
        assertThat(representative(NotificationStatus.SENT, NotificationStatus.PENDING))
                .contains(NotificationStatus.PENDING);
        assertThat(representative(NotificationStatus.SENT, NotificationStatus.PROCESSING))
                .contains(NotificationStatus.PENDING);
    }

    @Test
    @DisplayName("모두 SENT 이거나 SENT 와 CANCELLED 뿐이면 SENT")
    void sent() {
        assertThat(representative(NotificationStatus.SENT, NotificationStatus.SENT))
                .contains(NotificationStatus.SENT);
        assertThat(representative(NotificationStatus.SENT, NotificationStatus.CANCELLED))
                .contains(NotificationStatus.SENT);
    }

    @Test
    @DisplayName("CANCELLED 만 있으면 세지 않는다")
    void cancelledOnlyIsNotCounted() {
        assertThat(representative(NotificationStatus.CANCELLED)).isEmpty();
        assertThat(representative(NotificationStatus.CANCELLED, NotificationStatus.CANCELLED))
                .isEmpty();
    }
}
