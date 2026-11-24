package com.studyclub.domain.event.registration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.event.EventChannel;
import com.studyclub.domain.event.EventConfirmation;
import com.studyclub.domain.event.EventQuestionType;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class ClubEventRegistrationTest {

    private static final Long EVENT = 10L;
    private static final Long CREW = 20L;
    private static final Long CAPTAIN = 30L;
    private static final Instant NOW = Instant.parse("2026-12-01T09:00:00.123456789Z");

    private static ClubEventRegistration submit(EventConfirmation confirmation) {
        return submit(confirmation, Map.of());
    }

    private static ClubEventRegistration submit(
            EventConfirmation confirmation, Map<String, List<String>> answers) {
        return ClubEventRegistration.submit(
                EVENT,
                CREW,
                EventChannel.ONLINE,
                confirmation,
                "America/Vancouver",
                List.of(
                        new RegistrationQuestion(
                                "q-1", "참여 계기", EventQuestionType.TEXT, true, List.of())),
                answers,
                "6f1d2c34-5a6b-4c7d-8e9f-0a1b2c3d4e5f");
    }

    @Nested
    @DisplayName("신청 접수")
    class Submit {

        @Test
        @DisplayName("자동 확정 행사는 참가 확정, 운영진 확인 행사는 확인 대기로 접수한다")
        void statusFollowsConfirmation() {
            assertThat(submit(EventConfirmation.AUTO).getStatus())
                    .isEqualTo(ClubEventRegistrationStatus.CONFIRMED);
            assertThat(submit(EventConfirmation.REVIEW).getStatus())
                    .isEqualTo(ClubEventRegistrationStatus.PENDING);
        }

        @Test
        @DisplayName("접수 그대로면 취소 사유 · 상태 바꾼 시각 · 바꾼 사람이 없다")
        void noTransitionYet() {
            ClubEventRegistration registration = submit(EventConfirmation.REVIEW);

            assertThat(registration.getCancelReason()).isNull();
            assertThat(registration.getStatusChangedAt()).isNull();
            assertThat(registration.getStatusChangedBy()).isNull();
            assertThat(registration.getApplicantTimeZone()).isEqualTo("America/Vancouver");
            assertThat(registration.isActive()).isTrue();
        }

        @Test
        @DisplayName("빈 답은 키째 빼고, 답 순서는 받은 순서를 지킨다. 받은 목록을 나중에 바꿔도 사본은 그대로다")
        void answersAreCopied() {
            Map<String, List<String>> answers = new LinkedHashMap<>();
            List<String> first = new ArrayList<>(List.of("동료 추천"));
            answers.put("q-2", first);
            answers.put("q-1", List.of());
            answers.put("q-3", List.of("A", "B"));

            ClubEventRegistration registration = submit(EventConfirmation.AUTO, answers);
            first.add("나중에 더한 값");

            assertThat(registration.getAnswersSnapshot())
                    .containsExactly(
                            Map.entry("q-2", List.of("동료 추천")),
                            Map.entry("q-3", List.of("A", "B")));
        }
    }

    @Nested
    @DisplayName("상태 전이")
    class Transitions {

        @Test
        @DisplayName("운영진 확정 — 확인 대기만 참가 확정으로. 바꾼 캡틴 · 시각(마이크로초)을 남긴다")
        void confirm() {
            ClubEventRegistration registration = submit(EventConfirmation.REVIEW);

            registration.confirm(CAPTAIN, NOW);

            assertThat(registration.getStatus()).isEqualTo(ClubEventRegistrationStatus.CONFIRMED);
            assertThat(registration.getStatusChangedBy()).isEqualTo(CAPTAIN);
            assertThat(registration.getStatusChangedAt())
                    .isEqualTo(Instant.parse("2026-12-01T09:00:00.123456Z"));
            assertNotAllowed(() -> registration.confirm(CAPTAIN, NOW));
            assertNotAllowed(() -> registration.decline(CAPTAIN, NOW));
        }

        @Test
        @DisplayName("참가 불가 — 확인 대기만. 종료 자동 전환은 바꾼 사람이 없다. 참가 불가 뒤에는 취소도 안 된다")
        void decline() {
            ClubEventRegistration registration = submit(EventConfirmation.REVIEW);

            registration.decline(null, NOW);

            assertThat(registration.getStatus()).isEqualTo(ClubEventRegistrationStatus.DECLINED);
            assertThat(registration.getStatusChangedBy()).isNull();
            assertThat(registration.isActive()).isFalse();
            assertNotAllowed(() -> registration.cancelBySelf(NOW));
            assertNotAllowed(() -> registration.cancelByAdmin(CAPTAIN, NOW));
        }

        @Test
        @DisplayName("본인 취소 — 확정된 신청도 취소한다. 바꾼 사람은 신청자 본인, 사유는 SELF_CANCELLED. 두 번은 안 된다")
        void cancelBySelf() {
            ClubEventRegistration registration = submit(EventConfirmation.AUTO);

            registration.cancelBySelf(NOW);

            assertThat(registration.getStatus()).isEqualTo(ClubEventRegistrationStatus.CANCELLED);
            assertThat(registration.getCancelReason())
                    .isEqualTo(ClubEventRegistrationCancelReason.SELF_CANCELLED);
            assertThat(registration.getStatusChangedBy()).isEqualTo(CREW);
            assertNotAllowed(() -> registration.cancelBySelf(NOW));
        }

        @Test
        @DisplayName("운영진 개별 취소 — 사유 ADMIN_CANCELLED, 바꾼 사람은 캡틴")
        void cancelByAdmin() {
            ClubEventRegistration registration = submit(EventConfirmation.REVIEW);

            registration.cancelByAdmin(CAPTAIN, NOW);

            assertThat(registration.getCancelReason())
                    .isEqualTo(ClubEventRegistrationCancelReason.ADMIN_CANCELLED);
            assertThat(registration.getStatusChangedBy()).isEqualTo(CAPTAIN);
            assertNotAllowed(() -> registration.confirm(CAPTAIN, NOW));
        }

        private void assertNotAllowed(Runnable transition) {
            assertThatThrownBy(transition::run)
                    .isInstanceOf(BusinessException.class)
                    .extracting(e -> ((BusinessException) e).errorCode())
                    .isEqualTo(ErrorCode.EVENT_REGISTRATION_STATUS_NOT_ALLOWED);
        }
    }
}
