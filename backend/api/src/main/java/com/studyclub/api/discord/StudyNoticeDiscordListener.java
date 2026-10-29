package com.studyclub.api.discord;

import com.studyclub.common.error.BusinessException;
import com.studyclub.domain.notice.DiscordSkipReason;
import com.studyclub.domain.notice.StudyNoticeSent;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * 반 공지 → 그 스터디 로비 텍스트 채널에 글 한 건을 올리고 받는 사람을 멘션한다 (specs/study-notice/spec.md). 디스코드는 잃어도 되는 부수효과라
 * 커밋 뒤 비동기로 보낸다 — 실패해도 공지 접수는 되돌리지 않고 결과만 {@code STUDY_NOTICE.DISCORD_STATUS} 에 남긴다.
 *
 * <p>봇을 트랜잭션 밖에서 부른다(최대 30초). DB 읽기·쓰기는 {@link StudyNoticeDiscordRecorder} 의 짧은 트랜잭션이 맡는다. 재시도하지
 * 않는다 — 봇은 중복을 막지 않아 자동 재시도가 같은 글을 두 번 올릴 수 있다.
 */
@Component
public class StudyNoticeDiscordListener {

    private static final Logger log = LoggerFactory.getLogger(StudyNoticeDiscordListener.class);

    /**
     * 봇의 한 메시지 한도. 발신 줄 + 멘션 줄 + 본문을 합쳐 이 안이어야 한다 (discord/app/api/routes/channels.py MAX_TOTAL).
     */
    static final int MESSAGE_LIMIT = 2000;

    /** 발신 줄 「발신: <@19자리>」 과 줄바꿈. 넉넉히 잡는다. */
    private static final int SENDER_LINE = 32;

    /** 멘션 하나 「<@19자리>」 와 구분 공백. */
    private static final int PER_MENTION = 23;

    /** 봇이 한 번에 받는 멘션 수. */
    static final int MAX_MENTIONS = 40;

    private final DiscordBotClient discordBotClient;
    private final StudyNoticeDiscordRecorder recorder;

    public StudyNoticeDiscordListener(
            DiscordBotClient discordBotClient, StudyNoticeDiscordRecorder recorder) {
        this.discordBotClient = discordBotClient;
        this.recorder = recorder;
    }

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void onSent(StudyNoticeSent event) {
        if (!event.sendDiscord()) {
            return;
        }
        try {
            deliver(event);
        } catch (RuntimeException e) {
            // 메시지는 남기지 않는다 — HTTP 클라이언트 예외 메시지에 헤더 값(API 키)이 실릴 수 있다
            log.warn(
                    "{} {}: 공지 {} 디스코드 발송 실패 ({})",
                    event.name(),
                    event.meta().eventId(),
                    event.noticeId(),
                    e.getClass().getName());
            markFailedQuietly(event);
        }
    }

    private void deliver(StudyNoticeSent event) {
        Optional<StudyNoticeDiscordRecorder.Plan> prepared = recorder.prepare(event.noticeId());
        if (prepared.isEmpty()) {
            return; // 건너뜀으로 이미 기록했거나, 처리할 것이 없다
        }
        StudyNoticeDiscordRecorder.Plan plan = prepared.get();

        Optional<String> channelId = lobbyChannelId(plan);
        if (channelId.isEmpty()) {
            recorder.markSkipped(plan.noticeId(), DiscordSkipReason.NO_TEXT_CHANNEL);
            return;
        }

        List<Long> mentioned = new ArrayList<>();
        int posted = 0;
        try {
            for (Batch batch : batches(plan)) {
                discordBotClient.sendMessage(
                        plan.requesterDiscordId(),
                        channelId.get(),
                        plan.discordStudyId(),
                        batch.message(),
                        batch.discordIds());
                posted++;
                mentioned.addAll(batch.accountIds());
            }
        } catch (RuntimeException e) {
            // 메시지는 봇 응답을 옮긴 BusinessException 일 때만 남긴다 — 다른 HTTP 클라이언트 예외 메시지에는 헤더 값(API 키)이 실릴 수
            // 있다
            String cause = e instanceof BusinessException ? e.getMessage() : e.getClass().getName();
            if (posted == 0) {
                log.warn("공지 {} 디스코드 발송 실패, 손으로 알린다: {}", plan.noticeId(), cause);
                recorder.markFailed(plan.noticeId());
                return;
            }
            // 첫 글은 올라갔는데 이어서 올리는 글이 실패했다. 공지 자체는 전달됐으니 보냄으로 두고, 멘션하지 못한 사람은 로그로만 남긴다
            log.warn(
                    "공지 {} 디스코드 이어서 올리기 실패, {}명만 멘션했다: {}",
                    plan.noticeId(),
                    mentioned.size(),
                    cause);
        }
        recorder.markSent(plan.noticeId(), mentioned);
    }

    private Optional<String> lobbyChannelId(StudyNoticeDiscordRecorder.Plan plan) {
        return discordBotClient
                .getStudyChannels(plan.requesterDiscordId(), plan.discordStudyId())
                .stream()
                .filter(c -> c.discordChannelType() == DiscordBotClient.ChannelType.TEXT)
                .map(DiscordBotClient.StudyChannel::discordChannelId)
                .findFirst();
    }

    /**
     * 글을 나눈다. 첫 글은 제목·본문과 멘션을 함께 올리되, 본문이 길면 멘션 수를 줄여 합이 {@value #MESSAGE_LIMIT}자를 넘지 않게 한다 (본문이 가장
     * 길 때 16명). 남은 사람은 「이어서」 글로 40명씩 멘션한다. 멘션할 사람이 없으면 글 한 건만 올린다.
     */
    static List<Batch> batches(StudyNoticeDiscordRecorder.Plan plan) {
        // 디스코드 마크다운: 제목은 헤더(##), 반 이름과 보낸 사람은 작은 글자(-#) 한 줄, 본문은 인용 블록(>>>)이다.
        // 제목 · 반 이름 · 이름은 한 줄이어야 서식이 깨지지 않아 줄바꿈을 공백으로 바꾼다
        String title = "## 📢 " + oneLine(plan.title());
        // 시스템 ID 로 보내면 발신 줄이 봇 이름이다. 보낸 사람은 글자로 적는다(멘션이 아니라 알림은 가지 않는다)
        String meta =
                "-# "
                        + oneLine(plan.groupName())
                        + (plan.senderName() == null
                                ? ""
                                : " · 보낸 사람 " + oneLine(plan.senderName()));
        String first = title + "\n" + meta + "\n>>> " + plan.body();
        int room = Math.max(0, (MESSAGE_LIMIT - SENDER_LINE - first.length()) / PER_MENTION);
        int firstMentions = Math.min(MAX_MENTIONS, room);

        List<Map.Entry<Long, String>> people = new ArrayList<>(plan.mentionable().entrySet());
        List<Batch> result = new ArrayList<>();
        result.add(batch(first, people.subList(0, Math.min(firstMentions, people.size()))));
        String followUp = title + " (이어서 알림)\n" + meta;
        for (int from = firstMentions; from < people.size(); from += MAX_MENTIONS) {
            result.add(
                    batch(
                            followUp,
                            people.subList(from, Math.min(from + MAX_MENTIONS, people.size()))));
        }
        return result;
    }

    private static String oneLine(String text) {
        return text.replaceAll("\\s+", " ").trim();
    }

    private static Batch batch(String message, List<Map.Entry<Long, String>> people) {
        return new Batch(
                message,
                people.stream().map(Map.Entry::getKey).toList(),
                people.stream().map(Map.Entry::getValue).toList());
    }

    private void markFailedQuietly(StudyNoticeSent event) {
        try {
            recorder.markFailed(event.noticeId());
        } catch (RuntimeException e) {
            log.warn("공지 {} 디스코드 실패 기록도 못 남겼다 ({})", event.noticeId(), e.getClass().getName());
        }
    }

    /** 봇을 한 번 부를 때의 글과 멘션 대상. */
    record Batch(String message, List<Long> accountIds, List<String> discordIds) {}
}
