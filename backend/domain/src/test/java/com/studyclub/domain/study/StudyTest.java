package com.studyclub.domain.study;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class StudyTest {

    @Test
    @DisplayName("모집 중 + 마감 2일 후 → 종료 임박")
    void closingSoon_openAndDeadlineWithin3Days() {
        var study = getStudy(StudyStatus.OPEN, Instant.now().plus(2, ChronoUnit.DAYS));
        assertThat(study.isClosingSoon()).isTrue();
    }

    @Test
    @DisplayName("모집 중 + 마감 30일 후 → 종료 임박 아님")
    void notClosingSoon_openButDeadlineFarAway() {
        var study = getStudy(StudyStatus.OPEN, Instant.now().plus(30, ChronoUnit.DAYS));
        assertThat(study.isClosingSoon()).isFalse();
    }

    @Test
    @DisplayName("마감됨 + 마감일 가까움 → 종료 임박 아님 (OPEN 이 아니므로)")
    void notClosingSoon_closedStatus() {
        var study = getStudy(StudyStatus.CLOSED, Instant.now().plus(1, ChronoUnit.DAYS));
        assertThat(study.isClosingSoon()).isFalse();
    }

    @Test
    @DisplayName("모집 예정 + 마감일 가까움 → 종료 임박 아님 (OPEN 이 아니므로)")
    void notClosingSoon_draftStatus() {
        var study = getStudy(StudyStatus.DRAFT, Instant.now().plus(1, ChronoUnit.DAYS));
        assertThat(study.isClosingSoon()).isFalse();
    }

    @Test
    @DisplayName("모집 중 + 마감일 null → 종료 임박 아님")
    void notClosingSoon_nullDeadline() {
        var study = getStudy(StudyStatus.OPEN, null);
        assertThat(study.isClosingSoon()).isFalse();
    }

    @Test
    @DisplayName("모집 중 + 마감 전 + 정원 미달 → RECRUITING")
    void recruiting_beforeDeadlineAndUnderCapacity() {
        var study = getStudy(StudyStatus.OPEN, Instant.now().plus(7, ChronoUnit.DAYS), 30);
        assertThat(study.recruitStatus(29)).isEqualTo(RecruitStatus.RECRUITING);
    }

    @Test
    @DisplayName("마감 시각이 정확히 지금 → RECRUIT_CLOSED (경계는 마감 쪽)")
    void recruitClosed_deadlineExactlyNow() {
        Instant now = Instant.now();
        var study = getStudy(StudyStatus.OPEN, now, 30);
        assertThat(study.recruitStatus(0)).isEqualTo(RecruitStatus.RECRUIT_CLOSED);
    }

    @Test
    @DisplayName("마감 1초 전 → RECRUITING")
    void recruiting_oneSecondBeforeDeadline() {
        var study = getStudy(StudyStatus.OPEN, Instant.now().plusSeconds(1), 30);
        assertThat(study.recruitStatus(0)).isEqualTo(RecruitStatus.RECRUITING);
    }

    @Test
    @DisplayName("마감 시각 경과 → RECRUIT_CLOSED")
    void recruitClosed_deadlinePassed() {
        var study = getStudy(StudyStatus.OPEN, Instant.now().minusSeconds(1), 30);
        assertThat(study.recruitStatus(0)).isEqualTo(RecruitStatus.RECRUIT_CLOSED);
    }

    @Test
    @DisplayName("신청자 수 = 정원 → RECRUIT_CLOSED (정원 도달)")
    void recruitClosed_capacityReached() {
        var study = getStudy(StudyStatus.OPEN, Instant.now().plus(30, ChronoUnit.DAYS), 30);
        assertThat(study.recruitStatus(30)).isEqualTo(RecruitStatus.RECRUIT_CLOSED);
    }

    @Test
    @DisplayName("정원 초과 → RECRUIT_CLOSED")
    void recruitClosed_overCapacity() {
        var study = getStudy(StudyStatus.OPEN, Instant.now().plus(30, ChronoUnit.DAYS), 30);
        assertThat(study.recruitStatus(31)).isEqualTo(RecruitStatus.RECRUIT_CLOSED);
    }

    @Test
    @DisplayName("정원 null (무제한) + 신청자 많음 → RECRUITING")
    void recruiting_nullCapacityNeverFills() {
        var study = getStudy(StudyStatus.OPEN, Instant.now().plus(30, ChronoUnit.DAYS), null);
        assertThat(study.recruitStatus(9999)).isEqualTo(RecruitStatus.RECRUITING);
    }

    @Test
    @DisplayName("마감일 null (상시 모집) + 정원 미달 → RECRUITING")
    void recruiting_nullDeadlineNeverExpires() {
        var study = getStudy(StudyStatus.OPEN, null, 30);
        assertThat(study.recruitStatus(1)).isEqualTo(RecruitStatus.RECRUITING);
    }

    @Test
    @DisplayName("마감일 null (상시 모집) + 정원 도달 → RECRUIT_CLOSED")
    void recruitClosed_nullDeadlineButCapacityReached() {
        var study = getStudy(StudyStatus.OPEN, null, 30);
        assertThat(study.recruitStatus(30)).isEqualTo(RecruitStatus.RECRUIT_CLOSED);
    }

    @Test
    @DisplayName("DRAFT → 모집 상태 없음 (null). OPEN 일 때만 의미 있다")
    void noRecruitStatus_draft() {
        var study = getStudy(StudyStatus.DRAFT, Instant.now().plus(7, ChronoUnit.DAYS), 30);
        assertThat(study.recruitStatus(0)).isNull();
    }

    @Test
    @DisplayName("CLOSED → 모집 상태 없음 (null). 마감이 아니라 '없음'이다")
    void noRecruitStatus_closed() {
        var study = getStudy(StudyStatus.CLOSED, Instant.now().plus(7, ChronoUnit.DAYS), 30);
        assertThat(study.recruitStatus(0)).isNull();
    }

    private Study getStudy(StudyStatus status, Instant deadline) {
        return getStudy(status, deadline, 30);
    }

    private Study getStudy(StudyStatus status, Instant deadline, Integer capacity) {
        return Study.builder()
                .programId(1L)
                .studyDeliveryFormat(DeliveryFormat.ONLINE)
                .status(status)
                .recruitDeadline(deadline)
                .capacity(capacity)
                .build();
    }
}
