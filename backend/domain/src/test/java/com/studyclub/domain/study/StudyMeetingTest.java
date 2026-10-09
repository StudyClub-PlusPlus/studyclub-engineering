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
        assertThatThrownBy(() -> StudyMeeting.schedule(1L, FUTURE, " ".repeat(51)))
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

    @Test
    @DisplayName("반복으로 만든 회차는 묶음 ID 를 갖고, 한 번 만든 회차는 없다")
    void keepsSeriesId() {
        assertThat(StudyMeeting.schedule(1L, FUTURE, null, "s-1").getSeriesId()).isEqualTo("s-1");
        assertThat(StudyMeeting.schedule(1L, FUTURE, null).getSeriesId()).isNull();
        assertThat(StudyMeeting.schedule(1L, FUTURE, null).getMeetingType())
                .isEqualTo(MeetingType.REGULAR);
    }

    @Test
    @DisplayName("킥오프는 제목 「킥오프」 로 만들어지고 지울 수 없다 — KICKOFF_NOT_DELETABLE")
    void kickoffIsNotDeletable() {
        StudyMeeting kickoff = StudyMeeting.kickoff(1L, FUTURE);

        assertThat(kickoff.getTitle()).isEqualTo("킥오프");
        assertThat(kickoff.isKickoff()).isTrue();
        assertThatThrownBy(() -> kickoff.assertDeletable(NOW))
                .satisfies(e -> assertCode(e, ErrorCode.KICKOFF_NOT_DELETABLE));
    }

    @Test
    @DisplayName("발표자1과 발표자2가 같으면 INVALID_INPUT")
    void presentersMustDiffer() {
        StudyMeeting meeting = StudyMeeting.schedule(1L, FUTURE, null);

        assertThatThrownBy(() -> meeting.assignPresenters(7L, 7L))
                .satisfies(e -> assertCode(e, ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("킥오프에는 발표자를 둘 수 없다")
    void kickoffHasNoPresenters() {
        StudyMeeting kickoff = StudyMeeting.kickoff(1L, FUTURE);

        assertThatThrownBy(() -> kickoff.assignPresenters(7L, null))
                .satisfies(e -> assertCode(e, ErrorCode.INVALID_INPUT));
        assertThatThrownBy(() -> kickoff.signUpPresenter(1, 7L, NOW))
                .satisfies(e -> assertCode(e, ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("빈 칸에 신청하면 들어가고, 찬 칸은 PRESENTER_SLOT_TAKEN")
    void signUpIsFirstComeFirstServed() {
        StudyMeeting meeting = StudyMeeting.schedule(1L, FUTURE, null);

        meeting.signUpPresenter(1, 7L, NOW);

        assertThat(meeting.getPresenter1ParticipantId()).isEqualTo(7L);
        assertThatThrownBy(() -> meeting.signUpPresenter(1, 8L, NOW))
                .satisfies(e -> assertCode(e, ErrorCode.PRESENTER_SLOT_TAKEN));
    }

    @Test
    @DisplayName("한 회차에 한 칸만 — 다른 칸에 이미 있으면 PRESENTER_ALREADY_ASSIGNED")
    void signUpOneSlotPerMeeting() {
        StudyMeeting meeting = StudyMeeting.schedule(1L, FUTURE, null);
        meeting.signUpPresenter(1, 7L, NOW);

        assertThatThrownBy(() -> meeting.signUpPresenter(2, 7L, NOW))
                .satisfies(e -> assertCode(e, ErrorCode.PRESENTER_ALREADY_ASSIGNED));
    }

    @Test
    @DisplayName("남의 칸은 뺄 수 없다 — PRESENTER_NOT_ME. 내 칸은 빠진다")
    void cancelOnlyMine() {
        StudyMeeting meeting = StudyMeeting.schedule(1L, FUTURE, null);
        meeting.signUpPresenter(2, 7L, NOW);

        assertThatThrownBy(() -> meeting.cancelPresenter(2, 8L, NOW))
                .satisfies(e -> assertCode(e, ErrorCode.PRESENTER_NOT_ME));
        meeting.cancelPresenter(2, 7L, NOW);
        assertThat(meeting.getPresenter2ParticipantId()).isNull();
    }

    @Test
    @DisplayName("시작한 회차에는 신청할 수 없다 — MEETING_ALREADY_STARTED")
    void signUpRejectsStarted() {
        StudyMeeting meeting = StudyMeeting.schedule(1L, FUTURE, null);
        meeting.start(NOW);

        assertThatThrownBy(() -> meeting.signUpPresenter(1, 7L, NOW))
                .satisfies(e -> assertCode(e, ErrorCode.MEETING_ALREADY_STARTED));
    }

    @Test
    @DisplayName("칸 번호는 1·2 뿐이다")
    void slotMustBeOneOrTwo() {
        StudyMeeting meeting = StudyMeeting.schedule(1L, FUTURE, null);

        assertThatThrownBy(() -> meeting.signUpPresenter(3, 7L, NOW))
                .satisfies(e -> assertCode(e, ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("떠난 사람의 예정 회차 발표자 칸은 비우고, 시작한 회차는 기록이라 둔다")
    void releasesOnlyUpcomingSlots() {
        StudyMeeting upcoming = StudyMeeting.schedule(1L, FUTURE, null);
        upcoming.assignPresenters(7L, 8L);
        StudyMeeting started = StudyMeeting.schedule(1L, FUTURE, null);
        started.assignPresenters(7L, null);
        started.start(NOW);

        assertThat(upcoming.releasePresenter(7L, NOW)).isTrue();
        assertThat(started.releasePresenter(7L, NOW)).isFalse();
        assertThat(upcoming.getPresenter1ParticipantId()).isNull();
        assertThat(upcoming.getPresenter2ParticipantId()).isEqualTo(8L);
        assertThat(started.getPresenter1ParticipantId()).isEqualTo(7L);
    }

    private static void assertCode(Throwable e, ErrorCode code) {
        assertThat(((BusinessException) e).errorCode()).isEqualTo(code);
    }
}
