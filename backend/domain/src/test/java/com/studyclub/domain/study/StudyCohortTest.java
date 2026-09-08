package com.studyclub.domain.study;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class StudyCohortTest {

    @Test
    @DisplayName("모집 중 + 마감 2일 후 → 종료 임박")
    void closingSoon_openAndDeadlineWithin3Days() {
        var cohort = cohort(StudyCohortStatus.OPEN, Instant.now().plus(2, ChronoUnit.DAYS));
        assertThat(cohort.isClosingSoon()).isTrue();
    }

    @Test
    @DisplayName("모집 중 + 마감 30일 후 → 종료 임박 아님")
    void notClosingSoon_openButDeadlineFarAway() {
        var cohort = cohort(StudyCohortStatus.OPEN, Instant.now().plus(30, ChronoUnit.DAYS));
        assertThat(cohort.isClosingSoon()).isFalse();
    }

    @Test
    @DisplayName("마감됨 + 마감일 가까움 → 종료 임박 아님 (OPEN 이 아니므로)")
    void notClosingSoon_closedStatus() {
        var cohort = cohort(StudyCohortStatus.CLOSED, Instant.now().plus(1, ChronoUnit.DAYS));
        assertThat(cohort.isClosingSoon()).isFalse();
    }

    @Test
    @DisplayName("모집 예정 + 마감일 가까움 → 종료 임박 아님 (OPEN 이 아니므로)")
    void notClosingSoon_draftStatus() {
        var cohort = cohort(StudyCohortStatus.DRAFT, Instant.now().plus(1, ChronoUnit.DAYS));
        assertThat(cohort.isClosingSoon()).isFalse();
    }

    @Test
    @DisplayName("모집 중 + 마감일 null → 종료 임박 아님")
    void notClosingSoon_nullDeadline() {
        var cohort = cohort(StudyCohortStatus.OPEN, null);
        assertThat(cohort.isClosingSoon()).isFalse();
    }

    private StudyCohort cohort(StudyCohortStatus status, Instant deadline) {
        return new StudyCohort(1L, DeliveryFormat.ONLINE, status,
                null, null, 30, deadline, null, null, null, null);
    }
}
