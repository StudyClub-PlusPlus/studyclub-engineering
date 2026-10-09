package com.studyclub.domain.study;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class MeetingScheduleTest {

    private static final Instant NOW = Instant.parse("2026-10-02T00:00:00Z");

    @Test
    @DisplayName("기존 회차와 같은 현지 날짜면 MEETING_DATE_CONFLICT — 화면 미리보기 뒤 누가 그 날을 채운 경우라 건너뛰지 않고 막는다")
    void rejectsDayTakenByExistingMeeting() {
        var schedule =
                new MeetingSchedule(
                        "Asia/Seoul", List.of(meeting("2026-10-08T11:00:00Z"))); // KST 10/8 20:00

        assertThatThrownBy(
                        () ->
                                schedule.checkAdd(
                                        List.of(Instant.parse("2026-10-08T01:00:00Z")), NOW))
                .satisfies(e -> assertCode(e, ErrorCode.MEETING_DATE_CONFLICT));
    }

    @Test
    @DisplayName("같은 날은 UTC 가 아니라 분반 시간대로 본다 — 미주반 저녁 회차는 UTC 로 다음 날이다")
    void comparesDaysInGroupTimezone() {
        // 밴쿠버 10/8 19:00 PDT = UTC 10/9 02:00
        var schedule =
                new MeetingSchedule("America/Vancouver", List.of(meeting("2026-10-09T02:00:00Z")));

        // 밴쿠버 10/9 10:00 PDT = UTC 10/9 17:00 — UTC 날짜는 같지만 현지 날짜는 다르다
        assertThatCode(() -> schedule.checkAdd(List.of(Instant.parse("2026-10-09T17:00:00Z")), NOW))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("시간대가 비어 있으면 서울로 본다")
    void defaultsToSeoulWhenTimezoneMissing() {
        // KST 10/9 01:00 = UTC 10/8 16:00 → 서울 기준 10/9 이라 10/8 회차와 겹치지 않는다
        var schedule = new MeetingSchedule(null, List.of(meeting("2026-10-08T11:00:00Z")));

        assertThatCode(() -> schedule.checkAdd(List.of(Instant.parse("2026-10-08T16:00:00Z")), NOW))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("요청 안에서 같은 날이 둘이면 INVALID_INPUT")
    void rejectsDuplicateDayWithinRequest() {
        var schedule = new MeetingSchedule("Asia/Seoul", List.of());

        assertThatThrownBy(
                        () ->
                                schedule.checkAdd(
                                        List.of(
                                                Instant.parse("2026-10-08T01:00:00Z"),
                                                Instant.parse("2026-10-08T11:00:00Z")),
                                        NOW))
                .satisfies(e -> assertCode(e, ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("지난 시각이 하나라도 섞이면 INVALID_INPUT — 지금 이 순간도 지난 것으로 본다")
    void rejectsPastOrNow() {
        var schedule = new MeetingSchedule("Asia/Seoul", List.of());

        assertThatThrownBy(() -> schedule.checkAdd(List.of(NOW), NOW))
                .satisfies(e -> assertCode(e, ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("첫 날과 마지막 날이 30일 차이(시작일 포함 31일)면 통과, 31일 차이면 INVALID_INPUT")
    void enforces31DaySpanBoundary() {
        var schedule = new MeetingSchedule("Asia/Seoul", List.of());
        Instant first = Instant.parse("2026-10-05T11:00:00Z");

        assertThatCode(
                        () ->
                                schedule.checkAdd(
                                        List.of(first, Instant.parse("2026-11-04T11:00:00Z")), NOW))
                .doesNotThrowAnyException();
        assertThatThrownBy(
                        () ->
                                schedule.checkAdd(
                                        List.of(first, Instant.parse("2026-11-05T11:00:00Z")), NOW))
                .satisfies(e -> assertCode(e, ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("31일은 현지 날짜로 잰다 — 서머타임이 끝나 UTC 로 30일 1시간이 되어도 통과한다")
    void spanIgnoresDaylightSavingShift() {
        var schedule = new MeetingSchedule("America/Vancouver", List.of());

        // 밴쿠버 10/15 20:00 PDT → 11/14 20:00 PST. 현지 날짜 차이 30일, UTC 경과 30일 1시간
        assertThatCode(
                        () ->
                                schedule.checkAdd(
                                        List.of(
                                                Instant.parse("2026-11-15T04:00:00Z"),
                                                Instant.parse("2026-10-16T03:00:00Z")),
                                        NOW))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("0개 또는 32개면 INVALID_INPUT")
    void rejectsEmptyOrTooMany() {
        var schedule = new MeetingSchedule("Asia/Seoul", List.of());
        List<Instant> tooMany = new ArrayList<>();
        for (int i = 0; i < 32; i++) {
            tooMany.add(Instant.parse("2026-10-05T11:00:00Z").plusSeconds(86_400L * i));
        }

        assertThatThrownBy(() -> schedule.checkAdd(List.of(), NOW))
                .satisfies(e -> assertCode(e, ErrorCode.INVALID_INPUT));
        assertThatThrownBy(() -> schedule.checkAdd(tooMany, NOW))
                .satisfies(e -> assertCode(e, ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("회차를 같은 날 안에서 옮기는 건 자기 자신과 겹치지 않는다")
    void rescheduleIgnoresItself() {
        StudyMeeting target = meeting("2026-10-08T11:00:00Z");
        var schedule = new MeetingSchedule("Asia/Seoul", List.of(target));

        assertThatCode(
                        () ->
                                schedule.checkReschedule(
                                        target, Instant.parse("2026-10-08T12:00:00Z")))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("다른 회차가 있는 날로 옮기면 MEETING_DATE_CONFLICT")
    void rescheduleRejectsTakenDay() {
        StudyMeeting target = meeting("2026-10-08T11:00:00Z");
        var schedule =
                new MeetingSchedule("Asia/Seoul", List.of(target, meeting("2026-10-15T11:00:00Z")));

        assertThatThrownBy(
                        () ->
                                schedule.checkReschedule(
                                        target, Instant.parse("2026-10-15T01:00:00Z")))
                .satisfies(e -> assertCode(e, ErrorCode.MEETING_DATE_CONFLICT));
    }

    @Test
    @DisplayName("날짜는 초로 자른 시각으로 본다 — 서울 자정 0.9초 전은 반올림 없이 그날이다")
    void judgesDayOnTruncatedInstant() {
        // KST 10/8 23:59:59.9 → 저장값 23:59:59 → 10/8. 10/9 회차와 겹치지 않아야 한다
        var schedule = new MeetingSchedule("Asia/Seoul", List.of(meeting("2026-10-09T11:00:00Z")));

        assertThatCode(
                        () ->
                                schedule.checkAdd(
                                        List.of(Instant.parse("2026-10-08T14:59:59.900Z")), NOW))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("킥오프 날이나 그 앞으로는 정규 회차를 만들 수 없다 — INVALID_INPUT")
    void rejectsAddOnOrBeforeKickoff() {
        // 킥오프 KST 10/14(수) 20:30
        var schedule = new MeetingSchedule("Asia/Seoul", List.of(kickoff("2026-10-14T11:30:00Z")));

        assertThatThrownBy(
                        () ->
                                schedule.checkAdd(
                                        List.of(Instant.parse("2026-10-14T13:00:00Z")), NOW))
                .satisfies(e -> assertCode(e, ErrorCode.INVALID_INPUT))
                .hasMessageContaining("킥오프(10/14(수)) 뒤로만");
    }

    @Test
    @DisplayName("킥오프 다음 날부터는 정규 회차를 만들 수 있다")
    void allowsAddAfterKickoff() {
        var schedule = new MeetingSchedule("Asia/Seoul", List.of(kickoff("2026-10-14T11:30:00Z")));

        assertThatCode(() -> schedule.checkAdd(List.of(Instant.parse("2026-10-15T11:30:00Z")), NOW))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("킥오프가 없는 옛 분반은 순서 규칙이 없다")
    void noKickoffNoOrderRule() {
        var schedule = new MeetingSchedule("Asia/Seoul", List.of(meeting("2026-10-20T11:00:00Z")));

        assertThatCode(() -> schedule.checkAdd(List.of(Instant.parse("2026-10-05T11:00:00Z")), NOW))
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("정규 회차를 킥오프 날로 옮기면 INVALID_INPUT")
    void rejectsMovingRegularOntoKickoff() {
        StudyMeeting kickoff = kickoff("2026-10-14T11:30:00Z");
        StudyMeeting regular = meeting("2026-10-21T11:30:00Z");
        var schedule = new MeetingSchedule("Asia/Seoul", List.of(kickoff, regular));

        assertThatThrownBy(
                        () ->
                                schedule.checkReschedule(
                                        regular, Instant.parse("2026-10-14T13:00:00Z")))
                .satisfies(e -> assertCode(e, ErrorCode.INVALID_INPUT));
    }

    @Test
    @DisplayName("킥오프를 1회차 날이나 그 뒤로 옮기면 INVALID_INPUT, 앞이면 통과")
    void kickoffMustStayBeforeFirstRegular() {
        StudyMeeting kickoff = kickoff("2026-10-14T11:30:00Z");
        StudyMeeting first = meeting("2026-10-21T11:30:00Z");
        var schedule = new MeetingSchedule("Asia/Seoul", List.of(kickoff, first));

        assertThatThrownBy(
                        () ->
                                schedule.checkReschedule(
                                        kickoff, Instant.parse("2026-10-21T01:00:00Z")))
                .satisfies(e -> assertCode(e, ErrorCode.INVALID_INPUT));
        assertThatCode(
                        () ->
                                schedule.checkReschedule(
                                        kickoff, Instant.parse("2026-10-20T11:30:00Z")))
                .doesNotThrowAnyException();
    }

    private static StudyMeeting kickoff(String scheduledAt) {
        return StudyMeeting.kickoff(1L, Instant.parse(scheduledAt));
    }

    private static StudyMeeting meeting(String scheduledAt) {
        return StudyMeeting.schedule(1L, Instant.parse(scheduledAt), null);
    }

    private static void assertCode(Throwable e, ErrorCode code) {
        org.assertj.core.api.Assertions.assertThat(((BusinessException) e).errorCode())
                .isEqualTo(code);
    }
}
