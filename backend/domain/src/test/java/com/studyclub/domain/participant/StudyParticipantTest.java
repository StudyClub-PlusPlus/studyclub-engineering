package com.studyclub.domain.participant;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class StudyParticipantTest {

    private StudyParticipant participantWith(ParticipantStatus status, Instant leftAt) {
        return StudyParticipant.builder()
                .accountId(1L)
                .studyGroupId(1L)
                .studyId(1L)
                .status(status)
                .participantRole(ParticipantRole.MEMBER)
                .joinedAt(Instant.parse("2026-01-01T00:00:00Z"))
                .leftAt(leftAt)
                .build();
    }

    @Test
    @DisplayName("markWithdrawn_호출_시_STATUS가_WITHDRAWN이고_leftAt이_기록된다")
    void markWithdrawn_호출_시_STATUS가_WITHDRAWN이고_leftAt이_기록된다() {
        StudyParticipant participant = participantWith(ParticipantStatus.ACTIVE, null);
        Instant withdrawnAt = Instant.parse("2026-06-01T00:00:00Z");

        participant.markWithdrawn(withdrawnAt);

        assertThat(participant.getStatus()).isEqualTo(ParticipantStatus.WITHDRAWN);
        assertThat(participant.getLeftAt()).isEqualTo(withdrawnAt);
    }

    @Test
    @DisplayName("회원 탈퇴 - ACTIVE(leftAt 없음)였다면 탈퇴 시각을 leftAt 으로 채운다")
    void setsLeftAtForActiveParticipant() {
        StudyParticipant participant = participantWith(ParticipantStatus.ACTIVE, null);
        Instant deletedAt = Instant.parse("2026-09-01T00:00:00Z");

        participant.markDeletedDueToAccountDeletion(deletedAt);

        assertThat(participant.getStatus()).isEqualTo(ParticipantStatus.DELETED);
        assertThat(participant.getLeftAt()).isEqualTo(deletedAt);
    }

    @Test
    @DisplayName("회원 탈퇴 - 이미 WITHDRAWN 이었다면 하차 시각을 덮어쓰지 않는다 (출석률 오염 방지)")
    void keepsOriginalLeftAtWhenAlreadyWithdrawn() {
        Instant withdrawnAt = Instant.parse("2026-03-01T00:00:00Z");
        StudyParticipant participant = participantWith(ParticipantStatus.WITHDRAWN, withdrawnAt);
        Instant deletedAt = Instant.parse("2026-09-01T00:00:00Z");

        participant.markDeletedDueToAccountDeletion(deletedAt);

        assertThat(participant.getStatus()).isEqualTo(ParticipantStatus.DELETED);
        assertThat(participant.getLeftAt()).isEqualTo(withdrawnAt);
    }
}
