package com.studyclub.api.notice;

import com.studyclub.domain.notice.DiscordSkipReason;
import com.studyclub.domain.notice.SendBlockReason;
import java.time.Instant;
import java.util.List;

/**
 * 보내기 화면에 필요한 값. 보낼 수 있는가·디스코드가 되는가·한도는 <b>서버가 판정해 내려준다</b> — 화면이 날짜·횟수로 다시 계산하지 않는다. 이메일은 싣지 않는다.
 *
 * @param blockedReason 보낼 수 없는 이유. 보낼 수 있으면 null
 * @param nextAvailableAt {@code COOLDOWN} 일 때 다시 보낼 수 있는 시각
 * @param remainingToday 오늘(한국 시간) 이 반이 더 보낼 수 있는 횟수
 */
public record StudyNoticeComposeResponse(
        List<Recipient> recipients,
        Discord discord,
        boolean canSend,
        SendBlockReason blockedReason,
        Instant nextAvailableAt,
        int remainingToday) {

    /**
     * @param participantId 보낼 때 {@code participantIds} 에 넣는 값
     * @param participantRole {@code MEMBER} · {@code LEADER}
     * @param participantStatus {@code ACTIVE} · {@code PAUSED}
     * @param discordLinked 디스코드를 연동했는가 — 아니면 멘션에서 빠진다
     */
    public record Recipient(
            Long participantId,
            String displayName,
            String participantRole,
            String participantStatus,
            boolean discordLinked) {}

    /**
     * @param unavailableReason 디스코드를 못 쓰는 이유. 쓸 수 있으면 null
     */
    public record Discord(boolean available, DiscordSkipReason unavailableReason) {}
}
