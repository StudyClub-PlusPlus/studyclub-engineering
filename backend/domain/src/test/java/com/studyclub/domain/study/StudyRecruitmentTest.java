package com.studyclub.domain.study;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
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
}
