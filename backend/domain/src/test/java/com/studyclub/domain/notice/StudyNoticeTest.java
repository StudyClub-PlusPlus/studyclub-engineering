package com.studyclub.domain.notice;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

class StudyNoticeTest {

    private static StudyNotice notice(
            String title, String body, boolean email, boolean discord, List<Long> recipients) {
        return StudyNotice.create(1L, 2L, 3L, title, body, email, discord, recipients);
    }

    private static StudyNotice valid() {
        return notice("제목", "본문", true, true, List.of(10L, 11L));
    }

    @Nested
    @DisplayName("만들기")
    class Create {

        @Test
        @DisplayName("성공 - 앞뒤 공백을 자르고, 받는 사람 겹침을 걷어내고, 디스코드를 골랐으면 PENDING")
        void trimsAndDedups() {
            StudyNotice n = notice("  제목  ", "\n본문\n", true, true, List.of(10L, 10L, 11L));

            assertThat(n.getTitle()).isEqualTo("제목");
            assertThat(n.getBody()).isEqualTo("본문");
            assertThat(n.getRecipients())
                    .extracting(StudyNoticeRecipient::getAccountId)
                    .containsExactly(10L, 11L);
            assertThat(n.getDiscordStatus()).isEqualTo(DiscordDeliveryStatus.PENDING);
            assertThat(n.getRecipients()).noneMatch(StudyNoticeRecipient::isDiscordMentioned);
        }

        @Test
        @DisplayName("성공 - 디스코드를 안 골랐으면 NOT_REQUESTED")
        void emailOnly() {
            StudyNotice n = notice("제목", "본문", true, false, List.of(10L));

            assertThat(n.getDiscordStatus()).isEqualTo(DiscordDeliveryStatus.NOT_REQUESTED);
        }

        @Test
        @DisplayName("성공 - 제목 60자·본문 1,500자는 된다")
        void atLimits() {
            StudyNotice n = notice("가".repeat(60), "나".repeat(1500), true, false, List.of(10L));

            assertThat(n.getTitle()).hasSize(60);
            assertThat(n.getBody()).hasSize(1500);
        }

        @Test
        @DisplayName("실패 - 제목이 비었거나 61자면 거절한다 (자르지 않는다)")
        void badTitle() {
            assertInvalid(() -> notice("   ", "본문", true, false, List.of(10L)));
            assertInvalid(() -> notice("가".repeat(61), "본문", true, false, List.of(10L)));
            assertInvalid(() -> notice(null, "본문", true, false, List.of(10L)));
        }

        @Test
        @DisplayName("실패 - 본문이 비었거나 1,501자면 거절한다")
        void badBody() {
            assertInvalid(() -> notice("제목", "  ", true, false, List.of(10L)));
            assertInvalid(() -> notice("제목", "가".repeat(1501), true, false, List.of(10L)));
        }

        @Test
        @DisplayName("받는 사람은 500명까지 된다. 501명이면 거절한다")
        void recipientCap() {
            List<Long> many = java.util.stream.LongStream.rangeClosed(1, 500).boxed().toList();
            List<Long> tooMany = java.util.stream.LongStream.rangeClosed(1, 501).boxed().toList();

            assertThat(notice("제목", "본문", true, false, many).getRecipients()).hasSize(500);
            assertInvalid(() -> notice("제목", "본문", true, false, tooMany));
        }

        @Test
        @DisplayName("실패 - 보낼 곳이 없거나 받는 사람이 없으면 거절한다")
        void noChannelOrRecipient() {
            assertInvalid(() -> notice("제목", "본문", false, false, List.of(10L)));
            assertInvalid(() -> notice("제목", "본문", true, false, List.of()));
            assertInvalid(() -> notice("제목", "본문", true, false, null));
        }

        private void assertInvalid(Runnable create) {
            assertThatThrownBy(create::run)
                    .isInstanceOfSatisfying(
                            BusinessException.class,
                            e -> assertThat(e.errorCode()).isEqualTo(ErrorCode.INVALID_INPUT));
        }
    }

    @Nested
    @DisplayName("발송 한도 sendBlock")
    class SendBlockRule {

        private final Instant now = Instant.parse("2026-10-23T03:00:00Z");

        @Test
        @DisplayName("처음 보내면 막히지 않는다")
        void firstSend() {
            assertThat(StudyNotice.sendBlock(false, null, 0, now)).isEmpty();
        }

        @Test
        @DisplayName("직전 발송 59초 뒤는 COOLDOWN, 다시 보낼 수 있는 시각은 직전 + 1분")
        void cooldown() {
            Instant last = now.minusSeconds(59);

            assertThat(StudyNotice.sendBlock(false, last, 1, now))
                    .hasValueSatisfying(
                            b -> {
                                assertThat(b.reason()).isEqualTo(SendBlockReason.COOLDOWN);
                                assertThat(b.nextAvailableAt()).isEqualTo(last.plusSeconds(60));
                            });
        }

        @Test
        @DisplayName("직전 발송 정확히 60초 뒤는 통과한다")
        void exactlyOneMinute() {
            assertThat(StudyNotice.sendBlock(false, now.minusSeconds(60), 1, now)).isEmpty();
        }

        @Test
        @DisplayName("오늘 29번째까지 통과, 30번 보냈으면 DAILY_LIMIT")
        void dailyLimit() {
            Instant last = now.minusSeconds(3600);

            assertThat(StudyNotice.sendBlock(false, last, 29, now)).isEmpty();
            assertThat(StudyNotice.sendBlock(false, last, 30, now))
                    .hasValueSatisfying(
                            b -> {
                                assertThat(b.reason()).isEqualTo(SendBlockReason.DAILY_LIMIT);
                                assertThat(b.nextAvailableAt()).isNull();
                            });
        }

        @Test
        @DisplayName("COOLDOWN 과 DAILY_LIMIT 이 겹치면 COOLDOWN 이 먼저다")
        void cooldownFirst() {
            assertThat(StudyNotice.sendBlock(false, now.minusSeconds(10), 30, now))
                    .hasValueSatisfying(
                            b -> assertThat(b.reason()).isEqualTo(SendBlockReason.COOLDOWN));
        }

        @Test
        @DisplayName("끝난 스터디는 STUDY_ENDED — 쿨다운·하루 한도보다 먼저 판정한다")
        void studyEndedFirst() {
            assertThat(StudyNotice.sendBlock(true, null, 0, now))
                    .hasValueSatisfying(
                            b -> {
                                assertThat(b.reason()).isEqualTo(SendBlockReason.STUDY_ENDED);
                                assertThat(b.nextAvailableAt()).isNull();
                            });
            assertThat(StudyNotice.sendBlock(true, now.minusSeconds(10), 30, now))
                    .hasValueSatisfying(
                            b -> assertThat(b.reason()).isEqualTo(SendBlockReason.STUDY_ENDED));
        }

        @Test
        @DisplayName("오늘 시작은 한국 시간 0시 — 14:59:59Z 는 같은 날, 15:00:00Z 는 다음 날")
        void startOfTodayIsKst() {
            assertThat(StudyNotice.startOfToday(Instant.parse("2026-10-23T14:59:59Z")))
                    .isEqualTo(Instant.parse("2026-10-22T15:00:00Z"));
            assertThat(StudyNotice.startOfToday(Instant.parse("2026-10-23T15:00:00Z")))
                    .isEqualTo(Instant.parse("2026-10-23T15:00:00Z"));
        }

        @Test
        @DisplayName("남은 횟수는 0 밑으로 내려가지 않는다")
        void remaining() {
            assertThat(StudyNotice.remainingToday(0)).isEqualTo(30);
            assertThat(StudyNotice.remainingToday(29)).isEqualTo(1);
            assertThat(StudyNotice.remainingToday(45)).isZero();
        }
    }

    @Nested
    @DisplayName("디스코드 대기가 굳었을 때 effectiveDiscordStatus")
    class EffectiveDiscordStatus {

        private final Instant createdAt = Instant.parse("2026-10-23T03:00:00Z");

        @Test
        @DisplayName("보낸 지 9분 59초까지는 PENDING 그대로, 10분이 되면 FAILED 로 내려준다")
        void pendingTimesOutAtTenMinutes() {
            assertThat(
                            StudyNotice.effectiveDiscordStatus(
                                    DiscordDeliveryStatus.PENDING,
                                    createdAt,
                                    createdAt.plusSeconds(599)))
                    .isEqualTo(DiscordDeliveryStatus.PENDING);
            assertThat(
                            StudyNotice.effectiveDiscordStatus(
                                    DiscordDeliveryStatus.PENDING,
                                    createdAt,
                                    createdAt.plusSeconds(600)))
                    .isEqualTo(DiscordDeliveryStatus.FAILED);
        }

        @Test
        @DisplayName("PENDING 이 아니면 시간이 지나도 저장된 값 그대로다")
        void otherStatusesUntouched() {
            Instant later = createdAt.plusSeconds(3600);
            for (DiscordDeliveryStatus s : DiscordDeliveryStatus.values()) {
                if (s == DiscordDeliveryStatus.PENDING) {
                    continue;
                }
                assertThat(StudyNotice.effectiveDiscordStatus(s, createdAt, later)).isEqualTo(s);
            }
        }

        @Test
        @DisplayName("보낸 시각을 모르면(null) 저장된 값 그대로")
        void unknownCreatedAt() {
            assertThat(
                            StudyNotice.effectiveDiscordStatus(
                                    DiscordDeliveryStatus.PENDING, null, createdAt))
                    .isEqualTo(DiscordDeliveryStatus.PENDING);
        }
    }

    @Nested
    @DisplayName("디스코드 결과")
    class DiscordResult {

        @Test
        @DisplayName("보냄 - SENT 로 바꾸고 멘션된 사람만 표시한다")
        void sent() {
            StudyNotice n = valid();

            n.markDiscordSent(List.of(10L));

            assertThat(n.getDiscordStatus()).isEqualTo(DiscordDeliveryStatus.SENT);
            assertThat(n.getRecipients())
                    .filteredOn(StudyNoticeRecipient::isDiscordMentioned)
                    .extracting(StudyNoticeRecipient::getAccountId)
                    .containsExactly(10L);
        }

        @Test
        @DisplayName("건너뜀 - 사유를 남긴다. 멘션은 없다")
        void skipped() {
            StudyNotice n = valid();

            n.markDiscordSkipped(DiscordSkipReason.SENDER_NOT_LINKED);

            assertThat(n.getDiscordStatus()).isEqualTo(DiscordDeliveryStatus.SKIPPED);
            assertThat(n.getDiscordSkipReason()).isEqualTo(DiscordSkipReason.SENDER_NOT_LINKED);
            assertThat(n.getRecipients()).noneMatch(StudyNoticeRecipient::isDiscordMentioned);
        }

        @Test
        @DisplayName("실패 - FAILED")
        void failed() {
            StudyNotice n = valid();

            n.markDiscordFailed();

            assertThat(n.getDiscordStatus()).isEqualTo(DiscordDeliveryStatus.FAILED);
        }

        @Test
        @DisplayName("한 번 남긴 결과는 다시 바꾸지 못하고, 안 보낸 공지에도 남기지 못한다")
        void onlyFromPending() {
            StudyNotice done = valid();
            done.markDiscordFailed();
            StudyNotice emailOnly = notice("제목", "본문", true, false, List.of(10L));

            assertThatThrownBy(() -> done.markDiscordSent(List.of()))
                    .isInstanceOf(IllegalStateException.class);
            assertThatThrownBy(
                            () -> emailOnly.markDiscordSkipped(DiscordSkipReason.NO_TEXT_CHANNEL))
                    .isInstanceOf(IllegalStateException.class);
        }
    }
}
