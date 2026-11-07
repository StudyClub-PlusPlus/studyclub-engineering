package com.studyclub.api.stats;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.StudyMeeting;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.function.Predicate;
import org.junit.jupiter.api.Test;

class DashboardProfileWeekTest {
    private final AccountRepository accounts = mock(AccountRepository.class);
    private final DashboardTimeZoneResolver zones = new DashboardTimeZoneResolver(accounts);
    private final DashboardAttendanceAggregator attendance =
            mock(DashboardAttendanceAggregator.class);
    private final DashboardSummaryAggregateService summary =
            new DashboardSummaryAggregateService(
                    attendance, mock(StudyParticipantRepository.class), accounts);

    private record Mark(String at, double score) {}

    private void records(Mark... marks) {
        when(attendance.ratePercent(any(), any()))
                .thenAnswer(
                        call -> {
                            Predicate<StudyMeeting> filter = call.getArgument(1);
                            List<Mark> included =
                                    List.of(marks).stream()
                                            .filter(
                                                    mark ->
                                                            filter.test(
                                                                    new StudyMeeting(
                                                                            1L,
                                                                            Instant.parse(
                                                                                    mark.at()),
                                                                            null,
                                                                            null)))
                                            .toList();
                            return included.isEmpty()
                                    ? null
                                    : included.stream()
                                                    .mapToDouble(Mark::score)
                                                    .average()
                                                    .orElseThrow()
                                            * 100;
                        });
    }

    private void profile(String zone) {
        Account account = mock(Account.class);
        when(account.getTimeZone()).thenReturn(zone);
        when(accounts.findById(1L)).thenReturn(Optional.of(account));
    }

    @Test
    void sundayInBrowserBelongsToMondayInSeoulProfile() {
        records(new Mark("2026-10-26T16:00:00Z", 0), new Mark("2026-11-01T16:00:00Z", 1));
        Instant now = Instant.parse("2026-11-02T02:00:00Z");
        profile("Asia/Seoul");
        var seoul = summary.attendance(now, zones.resolve("America/New_York", 1L));
        assertThat(seoul.attendanceComparison().currentWeekStart()).isEqualTo("2026-11-02");
        assertThat(seoul.attendanceComparison().currentRate()).isEqualTo(100);
        assertThat(seoul.attendanceComparison().previousRate()).isZero();

        profile("America/New_York");
        var newYork = summary.attendance(now, zones.resolve("America/New_York", 1L));
        assertThat(newYork.attendanceComparison().currentWeekStart()).isEqualTo("2026-10-26");
        assertThat(newYork.attendanceComparison().currentRate()).isEqualTo(50);
        assertThat(newYork.attendanceComparison().previousRate()).isNull();
        assertThat(newYork.attendanceRate()).isEqualTo(seoul.attendanceRate());
    }

    @Test
    void laProfileKeepsLastSundayHourOfDstEndWeek() {
        profile("America/Los_Angeles");
        records(
                new Mark("2026-10-26T06:30:00Z", 1), // 전전 주 일요일
                new Mark("2026-10-26T07:00:00Z", 0), // 직전 주 월요일 00:00 PDT
                new Mark("2026-11-02T07:30:00Z", 1), // 직전 주 일요일 23:30 PST
                new Mark("2026-11-02T08:00:00Z", 0)); // 이번 주 월요일 00:00 PST
        var result =
                summary.attendance(
                        Instant.parse("2026-11-02T09:00:00Z"), zones.resolve("Asia/Seoul", 1L));
        assertThat(result.attendanceComparison().previousRate()).isEqualTo(50);
        assertThat(result.attendanceComparison().currentRate()).isZero();
    }
}
