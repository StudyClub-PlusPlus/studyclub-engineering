package com.studyclub.domain.participant;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.domain.study.StudyStatus;
import java.time.Instant;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ParticipationPeriodTest {
    private static final Instant START = Instant.parse("2025-01-01T00:00:00Z");
    private static final Instant END = Instant.parse("2025-06-01T00:00:00Z");
    private static final Instant CUTOFF = Instant.parse("2026-05-05T00:00:00Z");

    @Test
    @DisplayName("ACTIVE·PAUSED여도 스터디가 끝나면 종료일까지 참여한 것으로 본다")
    void activeRowsUseStudyEnd() {
        for (ParticipantStatus status :
                new ParticipantStatus[] {ParticipantStatus.ACTIVE, ParticipantStatus.PAUSED}) {
            StudyParticipant p = participant(status, null);
            assertThat(p.participationPeriod(StudyStatus.ONGOING, null).endedBefore(CUTOFF))
                    .isFalse();
            assertThat(
                            p.participationPeriod(StudyStatus.ONGOING, CUTOFF.plusSeconds(1))
                                    .endedBefore(CUTOFF))
                    .isFalse();
            assertThat(p.participationPeriod(StudyStatus.ENDED, END).endedBefore(CUTOFF)).isTrue();
            // 상태 갱신이 늦어도 종료 시각을 기준으로 본다.
            assertThat(p.participationPeriod(StudyStatus.ONGOING, END).endedBefore(CUTOFF))
                    .isTrue();
        }
    }

    @Test
    @DisplayName("완주는 스터디 종료일을 사용하고 종료일 미확인은 휴면에서 제외한다")
    void completedRowsUseStudyEnd() {
        var p = participant(ParticipantStatus.COMPLETED, null);
        assertThat(p.participationPeriod(StudyStatus.CLOSED, END))
                .isEqualTo(new ParticipationPeriod(START, END));
        assertThat(p.participationPeriod(StudyStatus.ENDED, null).endedBefore(CUTOFF)).isFalse();
    }

    @Test
    @DisplayName("하차·탈퇴는 하차일과 스터디 종료일 중 이른 시각까지만 참여한 것으로 본다")
    void withdrawnRowsUseEarlierEnd() {
        for (ParticipantStatus status :
                new ParticipantStatus[] {ParticipantStatus.WITHDRAWN, ParticipantStatus.DELETED}) {
            var p = participant(status, END);
            assertThat(p.participationPeriod(StudyStatus.ONGOING, null).endedAt()).isEqualTo(END);
            assertThat(p.participationPeriod(StudyStatus.ENDED, END.plusSeconds(10)).endedAt())
                    .isEqualTo(END);
            assertThat(p.participationPeriod(StudyStatus.ENDED, END.minusSeconds(10)).endedAt())
                    .isEqualTo(END.minusSeconds(10));
            assertThat(
                            participant(status, null)
                                    .participationPeriod(StudyStatus.ENDED, END)
                                    .endedBefore(CUTOFF))
                    .isFalse();
        }
    }

    @Test
    @DisplayName("스터디가 사라졌거나 날짜가 역전된 명부로는 휴면을 확정하지 않는다")
    void incompletePeriodsAreUnknown() {
        var p = participant(ParticipantStatus.COMPLETED, null);
        assertThat(p.participationPeriod(null, END).endedBefore(CUTOFF)).isFalse();
        assertThat(
                        p.participationPeriod(StudyStatus.ENDED, START.minusSeconds(1))
                                .endedBefore(CUTOFF))
                .isFalse();
        assertThat(new ParticipationPeriod(null, END).endedBefore(CUTOFF)).isFalse();
    }

    private static StudyParticipant participant(ParticipantStatus status, Instant leftAt) {
        return StudyParticipant.builder().status(status).joinedAt(START).leftAt(leftAt).build();
    }
}
