package com.studyclub.api.discord;

import com.studyclub.domain.account.Account;
import com.studyclub.domain.discord.StudyDiscordLinkRepository;
import com.studyclub.domain.notice.DiscordSkipReason;
import java.util.Optional;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * 스터디 공지를 디스코드로 보낼 수 있는가 — 보내기 화면(compose)과 비동기 발송이 <b>같은 메서드</b>로 판정한다. 화면이 보내기 전에 보여 준 사유와 실제로
 * 건너뛴 사유가 어긋나지 않게 하려는 것이다 (POL-0010).
 *
 * <p>텍스트 채널이 있는지({@link DiscordSkipReason#NO_TEXT_CHANNEL})는 봇에 물어야 알 수 있어 여기서 판정하지 않는다.
 */
@Component
public class StudyNoticeDiscordGate {

    private final DiscordBotClient discordBotClient;
    private final StudyDiscordLinkRepository studyDiscordLinkRepository;

    public StudyNoticeDiscordGate(
            DiscordBotClient discordBotClient,
            StudyDiscordLinkRepository studyDiscordLinkRepository) {
        this.discordBotClient = discordBotClient;
        this.studyDiscordLinkRepository = studyDiscordLinkRepository;
    }

    /**
     * 보낼 수 없는 이유. 보낼 수 있으면 비어 있다.
     *
     * @param sender 보내는 사람. 이미 탈퇴해 없으면 null — 연동하지 않은 것과 같이 본다. 연동하지 않았어도 봇 ID 가 있으면 시스템 호출로 보낸다
     */
    public Optional<DiscordSkipReason> unavailableReason(Long studyId, Account sender) {
        if (!discordBotClient.isConfigured()) {
            return Optional.of(DiscordSkipReason.BOT_NOT_CONFIGURED);
        }
        if (!studyDiscordLinkRepository.existsByStudyId(studyId)) {
            return Optional.of(DiscordSkipReason.NO_DISCORD_CHANNEL);
        }
        // 연동하지 않은 사람은 시스템 ID(봇 ID)로 대신 보낸다. 봇 ID 도 없을 때만 보낼 길이 없다
        if (!isLinked(sender) && !discordBotClient.canCallAsSystem()) {
            return Optional.of(DiscordSkipReason.SENDER_NOT_LINKED);
        }
        return Optional.empty();
    }

    /** 보내는 사람이 디스코드를 연동했는가. 이미 탈퇴해 없으면 연동하지 않은 것과 같이 본다. */
    public boolean isLinked(Account sender) {
        return sender != null && StringUtils.hasText(sender.getDiscordId());
    }

    /**
     * 봇을 부를 때 {@code X-Discord-User-ID} 에 넣는 값. 봇은 이 값으로 아무것도 검사하지 않고 메시지 맨 위 「발신」 줄만 만든다. 그래서 연동한
     * 사람은 <b>본인 디스코드 ID</b> 로 불러 발신 줄에 본인이 보이게 하고, 연동하지 않은 사람은 <b>시스템 ID(봇 ID)</b> 로 부른다 — 이때는 발신
     * 줄이 봇 이름이라 보낸 사람 이름을 본문에 따로 넣는다 ({@link StudyNoticeDiscordListener}).
     */
    public String requesterId(Account sender) {
        return isLinked(sender) ? sender.getDiscordId() : discordBotClient.systemUserId();
    }
}
