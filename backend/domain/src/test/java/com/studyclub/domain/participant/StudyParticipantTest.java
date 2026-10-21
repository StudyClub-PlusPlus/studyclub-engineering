package com.studyclub.domain.participant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import java.time.Instant;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

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

    @ParameterizedTest
    @EnumSource(
            value = ParticipantStatus.class,
            names = {"ACTIVE", "PAUSED"})
    @DisplayName("활성·휴식 참여자는 중단 시각을 기록한다 — 출석 집계의 상한이다")
    void withdrawsActiveParticipant(ParticipantStatus status) {
        var participant = participantWith(status, null);
        Instant at = Instant.parse("2026-06-01T00:00:00Z");
        assertThat(participant.markWithdrawn(at)).isTrue();
        assertThat(participant.getStatus()).isEqualTo(ParticipantStatus.WITHDRAWN);
        assertThat(participant.getLeftAt()).isEqualTo(at);
    }

    @Test
    @DisplayName("중단 재요청은 최초 시각을 보존한다 — 출석률의 집계 구간이 늘어나지 않는다")
    void preservesWithdrawalTimeOnRetry() {
        Instant original = Instant.parse("2026-06-01T00:00:00Z");
        var participant = participantWith(ParticipantStatus.WITHDRAWN, original);
        assertThat(participant.markWithdrawn(original.plusSeconds(100))).isFalse();
        assertThat(participant.getLeftAt()).isEqualTo(original);
    }

    @ParameterizedTest
    @EnumSource(
            value = ParticipantStatus.class,
            names = {"DELETED", "COMPLETED"})
    @DisplayName("탈퇴·완주 상태는 중단으로 바꿀 수 없다 — 종료 이력을 보존한다")
    void rejectsWithdrawalAfterParticipationEnds(ParticipantStatus status) {
        var participant = participantWith(status, null);
        assertThatThrownBy(() -> participant.markWithdrawn(Instant.now()))
                .isInstanceOf(BusinessException.class)
                .satisfies(
                        e ->
                                assertThat(((BusinessException) e).errorCode())
                                        .isEqualTo(ErrorCode.PARTICIPANT_NOT_ACTIVE));
        assertThat(participant.getStatus()).isEqualTo(status);
    }

    @Test
    @DisplayName("본인 중단은 별도 경로다 — 운영진 제명으로 처리하지 않는다")
    void rejectsSelfWithdrawal() {
        var participant = participantWith(ParticipantStatus.ACTIVE, null);
        assertThatThrownBy(() -> participant.assertWithdrawableBy(1L, 9L))
                .satisfies(
                        e ->
                                assertThat(((BusinessException) e).errorCode())
                                        .isEqualTo(ErrorCode.CANNOT_WITHDRAW_SELF));
    }

    @Test
    @DisplayName("담당 캡틴은 제명 대상이 아니다 — 운영 역할 변경과 분리한다")
    void rejectsCaptainWithdrawal() {
        var participant = participantWith(ParticipantStatus.ACTIVE, null);
        assertThatThrownBy(() -> participant.assertWithdrawableBy(2L, 1L))
                .satisfies(
                        e ->
                                assertThat(((BusinessException) e).errorCode())
                                        .isEqualTo(ErrorCode.FORBIDDEN));
    }

    @Test
    @DisplayName("네비게이터는 제명 대상이 아니다 — 운영 역할 변경과 분리한다")
    void rejectsNavigatorWithdrawal() {
        var participant =
                StudyParticipant.builder()
                        .accountId(1L)
                        .participantRole(ParticipantRole.LEADER)
                        .status(ParticipantStatus.ACTIVE)
                        .build();
        assertThatThrownBy(() -> participant.assertWithdrawableBy(2L, 9L))
                .satisfies(
                        e ->
                                assertThat(((BusinessException) e).errorCode())
                                        .isEqualTo(ErrorCode.FORBIDDEN));
    }
}
