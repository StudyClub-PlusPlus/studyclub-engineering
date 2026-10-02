package com.studyclub.domain.study;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import java.time.Instant;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class StudyMeetingTest {

    private static final Instant NOW = Instant.parse("2026-10-02T00:00:00Z");
    private static final Instant FUTURE = Instant.parse("2026-10-08T11:00:00Z");

    @Test
    @DisplayName("예정 시각 전이고 열리지 않았으면 시작 전")
    void notStartedBeforeScheduledAt() {
        assertThat(StudyMeeting.schedule(1L, FUTURE, null).isStarted(NOW)).isFalse();
    }

    @Test
    @DisplayName("예정 시각이 되면 시작한 회차 — 그 순간부터 출석이 찍힐 수 있다")
    void startedAtScheduledAt() {
        assertThat(StudyMeeting.schedule(1L, NOW, null).isStarted(NOW)).isTrue();
    }

    @Test
    @DisplayName("예정 시각 전이라도 디스코드가 먼저 열었으면 시작한 회차")
    void startedWhenOpenedEarly() {
        StudyMeeting meeting = StudyMeeting.schedule(1L, FUTURE, null);
        meeting.start(NOW);

        assertThat(meeting.isStarted(NOW)).isTrue();
    }

    @Test
    @DisplayName("시작한 회차는 옮길 수 없다 — MEETING_ALREADY_STARTED")
    void rescheduleRejectsStarted() {
        StudyMeeting meeting = StudyMeeting.schedule(1L, FUTURE, null);
        meeting.start(NOW);

        assertThatThrownBy(() -> meeting.reschedule(FUTURE.plusSeconds(3600), null, NOW))
                .satisfies(e -> assertCode(e, ErrorCode.MEETING_ALREADY_STARTED));
    }

    @Test
    @DisplayName("지난 시각으로 옮기면 INVALID_INPUT")
    void rescheduleRejectsPast() {
        StudyMeeting meeting = StudyMeeting.schedule(1L, FUTURE, null);

        assertThatThrownBy(() -> meeting.reschedule(NOW.minusSeconds(1), null, NOW))
                .satisfies(e -> assertCode(e, ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("옮기면 시각과 제목이 함께 바뀌고, null 제목은 제목을 지운다")
    void rescheduleReplacesTimeAndTitle() {
        StudyMeeting meeting = StudyMeeting.schedule(1L, FUTURE, "논문 읽기");
        Instant moved = FUTURE.plusSeconds(86_400);

        meeting.reschedule(moved, null, NOW);

        assertThat(meeting.getScheduledAt()).isEqualTo(moved);
        assertThat(meeting.getTitle()).isNull();
    }

    @Test
    @DisplayName("공백뿐인 제목은 없는 제목으로, 앞뒤 공백은 떼고 저장한다")
    void normalizesBlankTitle() {
        assertThat(StudyMeeting.schedule(1L, FUTURE, "   ").getTitle()).isNull();
        assertThat(StudyMeeting.schedule(1L, FUTURE, " 3주차 ").getTitle()).isEqualTo("3주차");
    }

    @Test
    @DisplayName("제목은 50자까지 — 51자면 INVALID_INPUT")
    void titleLengthBoundary() {
        assertThat(StudyMeeting.schedule(1L, FUTURE, "가".repeat(50)).getTitle()).hasSize(50);
        assertThatThrownBy(() -> StudyMeeting.schedule(1L, FUTURE, "가".repeat(51)))
                .satisfies(e -> assertCode(e, ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("길이는 공백을 떼기 전 입력으로 잰다 — 50자 뒤 공백 한 칸도 51자 입력이다")
    void titleLengthCountsRawInput() {
        assertThatThrownBy(() -> StudyMeeting.schedule(1L, FUTURE, "가".repeat(50) + " "))
                .satisfies(e -> assertCode(e, ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("예정 시각은 초 단위로 잘라 저장한다 — 소수초 없는 DATETIME 이 반올림해 날짜가 바뀌지 않게")
    void truncatesToSeconds() {
        assertThat(
                        StudyMeeting.schedule(1L, Instant.parse("2026-10-08T14:59:59.900Z"), null)
                                .getScheduledAt())
                .isEqualTo(Instant.parse("2026-10-08T14:59:59Z"));
    }

    private static void assertCode(Throwable e, ErrorCode code) {
        assertThat(((BusinessException) e).errorCode()).isEqualTo(code);
    }
}
