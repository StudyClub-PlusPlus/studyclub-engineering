package com.studyclub.api.stats;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyStatus;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class AdminStatsServiceTest {

    @Test
    @DisplayName("시간대 분류 — KST·ET·PT·그 외 UNKNOWN")
    void classifyTimeZone() {
        assertThat(AdminStatsService.classifyTimeZone("Asia/Seoul"))
                .isEqualTo(CrewTimeZoneGroupCode.KST);
        assertThat(AdminStatsService.classifyTimeZone("America/Toronto"))
                .isEqualTo(CrewTimeZoneGroupCode.ET);
        assertThat(AdminStatsService.classifyTimeZone("America/Los_Angeles"))
                .isEqualTo(CrewTimeZoneGroupCode.PT);
        assertThat(AdminStatsService.classifyTimeZone("Europe/London"))
                .isEqualTo(CrewTimeZoneGroupCode.UNKNOWN);
        assertThat(AdminStatsService.classifyTimeZone(null))
                .isEqualTo(CrewTimeZoneGroupCode.UNKNOWN);
        assertThat(AdminStatsService.classifyTimeZone("bogus"))
                .isEqualTo(CrewTimeZoneGroupCode.UNKNOWN);
    }

    @Test
    @DisplayName("deadlineBadge 우선순위 — 마감 경과 > 정원 > 미등록 > 임박 > 일반")
    void deadlineBadgePriority() {
        Instant asOf = Instant.parse("2026-09-16T03:00:00Z");
        Study open = Study.builder().programId(1L).status(StudyStatus.OPEN).build();

        assertThat(
                        AdminStatsService.deadlineBadge(
                                open, 0, Instant.parse("2026-09-15T00:00:00Z"), 10, asOf))
                .isEqualTo(DashboardDeadlineBadge.DEADLINE_PASSED);

        assertThat(
                        AdminStatsService.deadlineBadge(
                                open, 10, Instant.parse("2026-09-20T00:00:00Z"), 10, asOf))
                .isEqualTo(DashboardDeadlineBadge.CAPACITY_FULL);

        assertThat(AdminStatsService.deadlineBadge(open, 0, null, 10, asOf))
                .isEqualTo(DashboardDeadlineBadge.DEADLINE_MISSING);

        assertThat(
                        AdminStatsService.deadlineBadge(
                                open, 0, asOf.plus(2, ChronoUnit.DAYS), 10, asOf))
                .isEqualTo(DashboardDeadlineBadge.CLOSING_SOON);

        assertThat(
                        AdminStatsService.deadlineBadge(
                                open, 0, asOf.plus(10, ChronoUnit.DAYS), 10, asOf))
                .isEqualTo(DashboardDeadlineBadge.NORMAL);
    }
}
