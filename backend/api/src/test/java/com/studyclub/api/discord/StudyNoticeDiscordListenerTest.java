package com.studyclub.api.discord;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.common.event.EventMeta;
import com.studyclub.domain.notice.DiscordSkipReason;
import com.studyclub.domain.notice.StudyNoticeSent;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

/** 반 공지 → 디스코드. 봇·DB 는 목이라 아무 데도 보내지 않는다. */
class StudyNoticeDiscordListenerTest {

    private static final Long NOTICE_ID = 7L;
    private static final String REQUESTER = "1327394882193880000";
    private static final String DISCORD_STUDY_ID = "1327394882193883136";
    private static final String CHANNEL_ID = "1327394882193883200";

    private final DiscordBotClient bot = mock(DiscordBotClient.class);
    private final StudyNoticeDiscordRecorder recorder = mock(StudyNoticeDiscordRecorder.class);
    private final StudyNoticeDiscordListener listener =
            new StudyNoticeDiscordListener(bot, recorder);

    private static StudyNoticeSent event(boolean sendDiscord) {
        return new StudyNoticeSent(
                EventMeta.now(1L), NOTICE_ID, 10L, 20L, 1L, true, sendDiscord, 3);
    }

    /** 계정 ID 1..n → 19자리 디스코드 ID (봇의 길이 계산과 같은 폭이 되게). */
    private static Map<Long, String> people(int count) {
        Map<Long, String> map = new LinkedHashMap<>();
        for (long i = 1; i <= count; i++) {
            map.put(i, String.format("%019d", 1327394882193880000L + i));
        }
        return map;
    }

    private static StudyNoticeDiscordRecorder.Plan plan(
            String body, Map<Long, String> mentionable) {
        return new StudyNoticeDiscordRecorder.Plan(
                NOTICE_ID, "제목", body, "수요일반", REQUESTER, DISCORD_STUDY_ID, mentionable);
    }

    private static DiscordBotClient.StudyChannel channel(
            String id, DiscordBotClient.ChannelType type) {
        return new DiscordBotClient.StudyChannel(id, "채널", type);
    }

    /**
     * 봇이 거절하는 총 길이 계산 그대로 — 발신 줄 + 멘션 줄 + 본문 (discord/app/api/routes/channels.py compose_message).
     */
    private static int botLength(String requester, List<String> mentions, String msg) {
        String sender = "발신: <@" + requester + ">";
        String mentionLine =
                mentions.isEmpty()
                        ? ""
                        : String.join(" ", mentions.stream().map(m -> "<@" + m + ">").toList())
                                + "\n";
        return (sender + "\n" + mentionLine + msg).length();
    }

    @Nested
    @DisplayName("글 나누기 batches")
    class Batches {

        @Test
        @DisplayName("본문이 가장 길어도(1,500자) 첫 글은 봇의 2,000자 한도 안이다 — 멘션을 줄인다")
        void longestBodyFitsBotLimit() {
            var p = plan("가".repeat(1500), people(40));

            List<StudyNoticeDiscordListener.Batch> batches = StudyNoticeDiscordListener.batches(p);

            StudyNoticeDiscordListener.Batch first = batches.get(0);
            assertThat(first.discordIds().size()).isBetween(1, 40).isLessThan(40);
            assertThat(botLength(REQUESTER, first.discordIds(), first.message()))
                    .isLessThanOrEqualTo(2000);
            // 첫 글에 못 넣은 사람은 이어서 올리는 글이 받는다 — 빠지는 사람이 없다
            assertThat(batches.stream().flatMap(b -> b.accountIds().stream()).toList())
                    .containsExactlyElementsOf(p.mentionable().keySet());
            batches.forEach(
                    b ->
                            assertThat(botLength(REQUESTER, b.discordIds(), b.message()))
                                    .isLessThanOrEqualTo(2000));
        }

        @Test
        @DisplayName("본문이 짧으면 첫 글에 40명, 나머지는 40명씩 이어서")
        void shortBodySplitsBy40() {
            var p = plan("짧은 본문", people(100));

            var batches = StudyNoticeDiscordListener.batches(p);

            assertThat(batches).extracting(b -> b.accountIds().size()).containsExactly(40, 40, 20);
            assertThat(batches.get(0).message()).contains("짧은 본문");
            assertThat(batches.get(1).message()).doesNotContain("짧은 본문").contains("이어서");
        }

        @Test
        @DisplayName("멘션할 사람이 없으면 글 한 건만, 멘션 없이")
        void nobodyToMention() {
            var batches = StudyNoticeDiscordListener.batches(plan("본문", Map.of()));

            assertThat(batches).hasSize(1);
            assertThat(batches.get(0).discordIds()).isEmpty();
            assertThat(batches.get(0).message()).startsWith("📢 [수요일반] 제목").contains("본문");
        }
    }

    @Nested
    @DisplayName("발송")
    class Deliver {

        @Test
        @DisplayName("디스코드를 안 골랐으면 아무것도 하지 않는다")
        void notRequested() {
            listener.onSent(event(false));

            verifyNoInteractions(bot, recorder);
        }

        @Test
        @DisplayName("건너뜀으로 이미 기록됐으면(비어 있는 계획) 봇을 부르지 않는다")
        void alreadySkipped() {
            when(recorder.prepare(NOTICE_ID)).thenReturn(Optional.empty());

            listener.onSent(event(true));

            verifyNoInteractions(bot);
            verify(recorder, never()).markSent(any(), anyCollection());
        }

        @Test
        @DisplayName("성공 - 로비 텍스트 채널에 올리고 멘션된 사람을 SENT 로 남긴다 (보내는 사람 본인의 디스코드 ID 로)")
        void success() {
            when(recorder.prepare(NOTICE_ID)).thenReturn(Optional.of(plan("본문", people(3))));
            when(bot.getStudyChannels(REQUESTER, DISCORD_STUDY_ID))
                    .thenReturn(
                            List.of(
                                    channel(
                                            "1327394882193883300",
                                            DiscordBotClient.ChannelType.VOICE),
                                    channel(CHANNEL_ID, DiscordBotClient.ChannelType.TEXT)));

            listener.onSent(event(true));

            ArgumentCaptor<List<String>> mentions = ArgumentCaptor.forClass(List.class);
            verify(bot)
                    .sendMessage(
                            eq(REQUESTER),
                            eq(CHANNEL_ID),
                            eq(DISCORD_STUDY_ID),
                            anyString(),
                            mentions.capture());
            assertThat(mentions.getValue()).hasSize(3);
            verify(recorder).markSent(eq(NOTICE_ID), eq(List.of(1L, 2L, 3L)));
        }

        @Test
        @DisplayName("텍스트 채널이 없으면 NO_TEXT_CHANNEL 로 건너뛴다")
        void noTextChannel() {
            when(recorder.prepare(NOTICE_ID)).thenReturn(Optional.of(plan("본문", people(2))));
            when(bot.getStudyChannels(REQUESTER, DISCORD_STUDY_ID))
                    .thenReturn(List.of(channel(CHANNEL_ID, DiscordBotClient.ChannelType.VOICE)));

            listener.onSent(event(true));

            verify(recorder).markSkipped(NOTICE_ID, DiscordSkipReason.NO_TEXT_CHANNEL);
            verify(bot, never())
                    .sendMessage(anyString(), anyString(), anyString(), anyString(), anyList());
        }

        @Test
        @DisplayName("봇이 첫 글을 거절하면 FAILED")
        void firstPostRejected() {
            when(recorder.prepare(NOTICE_ID)).thenReturn(Optional.of(plan("본문", people(2))));
            when(bot.getStudyChannels(REQUESTER, DISCORD_STUDY_ID))
                    .thenReturn(List.of(channel(CHANNEL_ID, DiscordBotClient.ChannelType.TEXT)));
            doThrow(new BusinessException(ErrorCode.EXTERNAL_SERVICE_ERROR, "봇이 거절했습니다."))
                    .when(bot)
                    .sendMessage(anyString(), anyString(), anyString(), anyString(), anyList());

            listener.onSent(event(true));

            verify(recorder).markFailed(NOTICE_ID);
            verify(recorder, never()).markSent(any(), anyCollection());
        }

        @Test
        @DisplayName("첫 글은 올라갔는데 이어서 올리는 글이 실패하면 SENT — 멘션된 사람만 남긴다")
        void followUpRejected() {
            when(recorder.prepare(NOTICE_ID)).thenReturn(Optional.of(plan("짧게", people(60))));
            when(bot.getStudyChannels(REQUESTER, DISCORD_STUDY_ID))
                    .thenReturn(List.of(channel(CHANNEL_ID, DiscordBotClient.ChannelType.TEXT)));
            doNothingThenThrow();

            listener.onSent(event(true));

            ArgumentCaptor<java.util.Collection<Long>> mentioned =
                    ArgumentCaptor.forClass(java.util.Collection.class);
            verify(recorder).markSent(eq(NOTICE_ID), mentioned.capture());
            assertThat(mentioned.getValue()).hasSize(40);
            verify(recorder, never()).markFailed(any());
            verify(bot, times(2))
                    .sendMessage(anyString(), anyString(), anyString(), anyString(), anyList());
        }

        @Test
        @DisplayName(
                "이어서 올리는 글이 일반 예외(BusinessException 이 아닌 것)로 실패해도 첫 글이 올라갔으면 SENT — 이미 전달된 공지를 실패로 보이지 않는다")
        void followUpFailsWithPlainException() {
            when(recorder.prepare(NOTICE_ID)).thenReturn(Optional.of(plan("짧게", people(60))));
            when(bot.getStudyChannels(REQUESTER, DISCORD_STUDY_ID))
                    .thenReturn(List.of(channel(CHANNEL_ID, DiscordBotClient.ChannelType.TEXT)));
            org.mockito.Mockito.doNothing()
                    .doThrow(new IllegalStateException("연결이 끊겼다"))
                    .when(bot)
                    .sendMessage(anyString(), anyString(), anyString(), anyString(), anyList());

            listener.onSent(event(true));

            ArgumentCaptor<java.util.Collection<Long>> mentioned =
                    ArgumentCaptor.forClass(java.util.Collection.class);
            verify(recorder).markSent(eq(NOTICE_ID), mentioned.capture());
            assertThat(mentioned.getValue()).hasSize(40);
            verify(recorder, never()).markFailed(any());
        }

        @Test
        @DisplayName("첫 글부터 일반 예외로 실패하면 FAILED")
        void firstPostFailsWithPlainException() {
            when(recorder.prepare(NOTICE_ID)).thenReturn(Optional.of(plan("본문", people(2))));
            when(bot.getStudyChannels(REQUESTER, DISCORD_STUDY_ID))
                    .thenReturn(List.of(channel(CHANNEL_ID, DiscordBotClient.ChannelType.TEXT)));
            doThrow(new IllegalStateException("연결이 끊겼다"))
                    .when(bot)
                    .sendMessage(anyString(), anyString(), anyString(), anyString(), anyList());

            listener.onSent(event(true));

            verify(recorder).markFailed(NOTICE_ID);
            verify(recorder, never()).markSent(any(), anyCollection());
        }

        @Test
        @DisplayName("예상 못 한 예외도 삼키고 FAILED 로 남긴다 — 이미 커밋된 공지를 되돌리지 않는다")
        void unexpectedException() {
            when(recorder.prepare(NOTICE_ID)).thenReturn(Optional.of(plan("본문", people(2))));
            when(bot.getStudyChannels(REQUESTER, DISCORD_STUDY_ID))
                    .thenThrow(new IllegalStateException("연결이 끊겼다"));

            listener.onSent(event(true));

            verify(recorder).markFailed(NOTICE_ID);
        }

        private void doNothingThenThrow() {
            org.mockito.Mockito.doNothing()
                    .doThrow(new BusinessException(ErrorCode.EXTERNAL_SERVICE_ERROR, "봇이 거절했습니다."))
                    .when(bot)
                    .sendMessage(anyString(), anyString(), anyString(), anyString(), anyList());
        }
    }
}
