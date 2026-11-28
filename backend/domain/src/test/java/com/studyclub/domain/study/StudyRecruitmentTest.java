package com.studyclub.domain.study;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class StudyRecruitmentTest {

    @Test
    @DisplayName("활성 인원이 모집 회차 정원에 도달하면 가득 찬 것으로 본다")
    void fullWhenActiveParticipantCountReachesRecruitmentCapacity() {
        StudyRecruitment recruitment = StudyRecruitment.builder().recruitmentCapacity(2).build();

        assertThat(recruitment.isFull(1)).isFalse();
        assertThat(recruitment.isFull(2)).isTrue();
        assertThat(recruitment.isFull(3)).isTrue();
    }

    @Test
    @DisplayName("모집 회차 정원이 없으면 인원 제한이 없다")
    void neverFullWithoutRecruitmentCapacity() {
        StudyRecruitment recruitment = StudyRecruitment.builder().build();

        assertThat(recruitment.isFull(Long.MAX_VALUE)).isFalse();
    }

    @Test
    @DisplayName("정원: 바꾼 값이 모집 상태 판정 기준이 되고, null 이면 무제한이다")
    void updateCapacity_updatesRecruitStatusBasis() {
        var study = Study.builder().programId(1L).status(StudyStatus.OPEN).build();
        var recruitment = StudyRecruitment.builder().recruitmentCapacity(30).build();
        Instant deadline = Instant.now().plus(7, ChronoUnit.DAYS);

        recruitment.updateCapacity(5);
        assertThat(study.recruitStatus(5, deadline, recruitment.getRecruitmentCapacity()))
                .isEqualTo(RecruitStatus.RECRUIT_CLOSED);

        recruitment.updateCapacity(null);
        assertThat(recruitment.getRecruitmentCapacity()).isNull();
        assertThat(study.recruitStatus(9999, deadline, recruitment.getRecruitmentCapacity()))
                .isEqualTo(RecruitStatus.RECRUITING);
    }

    @Test
    @DisplayName("정원: 1 미만은 받지 않는다")
    void updateCapacity_rejectsBelowOne() {
        var recruitment = StudyRecruitment.builder().recruitmentCapacity(30).build();

        assertThatThrownBy(() -> recruitment.updateCapacity(0))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(recruitment.getRecruitmentCapacity()).isEqualTo(30);
    }

    @Test
    @DisplayName("모집 시간대: 새 모집 회차는 미정(unset)이다")
    void timeZones_defaultUnset() {
        StudyRecruitment recruitment = StudyRecruitment.builder().build();

        assertThat(recruitment.timeZones()).isEqualTo(RecruitmentTimeZones.UNSET);
    }

    @Test
    @DisplayName("모집 시간대 교체: 남은 지역은 같은 행을 두고, 빠진 지역만 지우고 새 지역만 더한다")
    void changeTimeZones_keepsExistingRows() {
        StudyRecruitment recruitment = StudyRecruitment.builder().build();
        recruitment.changeTimeZones(
                RecruitmentTimeZones.of("selected", List.of("Asia/Seoul", "America/Los_Angeles")));

        recruitment.changeTimeZones(
                RecruitmentTimeZones.of(
                        "selected", List.of("America/Los_Angeles", "Europe/London")));

        assertThat(recruitment.timeZones().mode()).isEqualTo(RecruitmentTimeZoneMode.SELECTED);
        assertThat(recruitment.timeZones().zones())
                .containsExactly("America/Los_Angeles", "Europe/London");
    }

    @Test
    @DisplayName("모집 시간대 교체: all · unset 으로 바꾸면 지역을 모두 지운다")
    void changeTimeZones_toAllClearsZones() {
        StudyRecruitment recruitment = StudyRecruitment.builder().build();
        recruitment.changeTimeZones(RecruitmentTimeZones.of("selected", List.of("Asia/Seoul")));

        recruitment.changeTimeZones(RecruitmentTimeZones.of("all", List.of()));

        assertThat(recruitment.timeZones())
                .isEqualTo(new RecruitmentTimeZones(RecruitmentTimeZoneMode.ALL, List.of()));
    }

    @Test
    @DisplayName("모집 시간대 읽기: 모드와 지역이 어긋난 행도 예외 없이 읽는다 — all 에 남은 지역은 무시, 지역 없는 selected 는 unset")
    void timeZones_toleratesBrokenRows() {
        StudyRecruitment allWithZone =
                StudyRecruitment.builder()
                        .timeZoneMode(RecruitmentTimeZoneMode.ALL)
                        .zones(
                                new java.util.ArrayList<>(
                                        List.of(new StudyRecruitmentZone("Asia/Tokyo"))))
                        .build();
        StudyRecruitment selectedWithoutZone =
                StudyRecruitment.builder().timeZoneMode(RecruitmentTimeZoneMode.SELECTED).build();

        assertThat(allWithZone.timeZones())
                .isEqualTo(new RecruitmentTimeZones(RecruitmentTimeZoneMode.ALL, List.of()));
        assertThat(selectedWithoutZone.timeZones()).isEqualTo(RecruitmentTimeZones.UNSET);
    }
}
