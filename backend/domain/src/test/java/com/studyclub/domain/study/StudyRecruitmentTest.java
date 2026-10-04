package com.studyclub.domain.study;

import static org.assertj.core.api.Assertions.assertThat;

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
}
