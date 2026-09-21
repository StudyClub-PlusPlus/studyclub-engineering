package com.studyclub.domain.participant;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class StudyParticipantCountsTest {

    @Test
    @DisplayName("정원 점유는 ACTIVE + PAUSED, 참여 인원은 하차자만 뺀다")
    void occupyingAndParticipated() {
        var counts =
                StudyParticipantCounts.of(
                        Map.of(
                                ParticipantStatus.ACTIVE, 2L,
                                ParticipantStatus.PAUSED, 1L,
                                ParticipantStatus.COMPLETED, 4L,
                                ParticipantStatus.WITHDRAWN, 3L));

        assertThat(counts.occupying()).isEqualTo(3);
        assertThat(counts.participated()).isEqualTo(7);
    }

    @Test
    @DisplayName("완주율은 하차자까지 분모에 넣어 반올림한다 — 완주 2 / 전체 3 → 67")
    void completionRate() {
        var counts =
                StudyParticipantCounts.of(
                        Map.of(ParticipantStatus.COMPLETED, 2L, ParticipantStatus.WITHDRAWN, 1L));

        assertThat(counts.completionRate()).isEqualTo(67);
    }

    @Test
    @DisplayName("참여 이력이 없으면 완주율은 null")
    void completionRate_noParticipants() {
        assertThat(StudyParticipantCounts.EMPTY.completionRate()).isNull();
    }
}
