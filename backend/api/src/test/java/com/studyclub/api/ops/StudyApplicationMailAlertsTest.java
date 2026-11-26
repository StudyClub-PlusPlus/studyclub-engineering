package com.studyclub.api.ops;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.studyclub.common.event.EventMeta;
import com.studyclub.notification.StudyApplicationMailSkipped;
import java.time.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class StudyApplicationMailAlertsTest {
    private final OpsAlertNotifier notifier = mock(OpsAlertNotifier.class);
    private final MutableClock clock = new MutableClock();
    private final StudyApplicationMailAlerts alerts =
            new StudyApplicationMailAlerts(notifier, clock);

    @Test
    @DisplayName("첫 누락은 즉시 알리고 반복 누락은 추가 이벤트가 없어도 10분 뒤 건수를 모아 보낸다")
    void batchesAndFlushesWithoutAnotherApplication() {
        alerts.onSkipped(event(1L, 10L, StudyApplicationMailSkipped.Reason.TEMPLATE_MISSING));
        alerts.onSkipped(event(1L, 11L, StudyApplicationMailSkipped.Reason.TEMPLATE_MISSING));
        alerts.onSkipped(event(1L, 12L, StudyApplicationMailSkipped.Reason.TEMPLATE_MISSING));
        verify(notifier)
                .send(
                        eq(OpsAlertNotifier.Level.WARN),
                        anyString(),
                        argThat(fields -> fields.get("누락 건수").equals("1")));
        clock.advance(Duration.ofMinutes(10).minusSeconds(1));
        alerts.flush();
        verifyNoMoreInteractions(notifier);
        clock.advance(Duration.ofSeconds(1));
        alerts.flush();
        verify(notifier)
                .send(
                        eq(OpsAlertNotifier.Level.WARN),
                        anyString(),
                        argThat(
                                fields ->
                                        fields.get("누락 건수").equals("2")
                                                && fields.get("최근 신청 ID").equals("12")));
        alerts.flush();
        verifyNoMoreInteractions(notifier);
    }

    @Test
    @DisplayName("스터디나 누락 사유가 다르면 각각 즉시 경고한다")
    void independentKeys() {
        alerts.onSkipped(event(1L, 10L, StudyApplicationMailSkipped.Reason.TEMPLATE_MISSING));
        alerts.onSkipped(event(2L, 11L, StudyApplicationMailSkipped.Reason.TEMPLATE_MISSING));
        alerts.onSkipped(event(1L, 12L, StudyApplicationMailSkipped.Reason.OWNER_MISSING));
        verify(notifier, times(3)).send(eq(OpsAlertNotifier.Level.WARN), anyString(), anyMap());
    }

    @Test
    @DisplayName("요약 발송 뒤에도 10분 제한을 지키며 조용해진 스터디는 집계에서 제거한다")
    void maintainsLimitAfterSummaryAndExpiresIdleKey() {
        alerts.onSkipped(event(1L, 1L, StudyApplicationMailSkipped.Reason.OWNER_MISSING));
        alerts.onSkipped(event(1L, 2L, StudyApplicationMailSkipped.Reason.OWNER_MISSING));
        clock.advance(Duration.ofMinutes(10));
        alerts.flush();
        alerts.onSkipped(event(1L, 3L, StudyApplicationMailSkipped.Reason.OWNER_MISSING));
        verify(notifier, times(2)).send(any(), anyString(), anyMap());
        clock.advance(Duration.ofMinutes(10));
        alerts.flush();
        verify(notifier, times(3)).send(any(), anyString(), anyMap());
        clock.advance(Duration.ofMinutes(10));
        alerts.flush();
        alerts.onSkipped(event(1L, 4L, StudyApplicationMailSkipped.Reason.OWNER_MISSING));
        verify(notifier, times(4)).send(any(), anyString(), anyMap());
    }

    @Test
    @DisplayName("주기 작업보다 다음 신청이 먼저 오면 이전 누락 건수와 함께 한 번만 알린다")
    void expiredWindowDrainsOnNextApplication() {
        alerts.onSkipped(event(1L, 1L, StudyApplicationMailSkipped.Reason.OWNER_MISSING));
        alerts.onSkipped(event(1L, 2L, StudyApplicationMailSkipped.Reason.OWNER_MISSING));
        clock.advance(Duration.ofMinutes(10));
        alerts.onSkipped(event(1L, 3L, StudyApplicationMailSkipped.Reason.OWNER_MISSING));
        alerts.flush();
        verify(notifier)
                .send(any(), anyString(), argThat(fields -> fields.get("누락 건수").equals("2")));
        verify(notifier, times(2)).send(any(), anyString(), anyMap());
    }

    private StudyApplicationMailSkipped event(
            Long studyId, Long id, StudyApplicationMailSkipped.Reason reason) {
        return new StudyApplicationMailSkipped(EventMeta.now(null), studyId, id, reason);
    }

    private static class MutableClock extends Clock {
        private Instant now = Instant.parse("2026-11-26T12:00:00Z");

        void advance(Duration duration) {
            now = now.plus(duration);
        }

        @Override
        public Instant instant() {
            return now;
        }

        @Override
        public ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }
    }
}
