package com.studyclub.domain.account;

import com.studyclub.common.event.DomainEvent;
import com.studyclub.common.event.EventMeta;
import java.util.List;

/**
 * 회원 탈퇴로 계정이 지워졌다. 탈퇴 트랜잭션 안에서 발행되고, 구독자는 커밋 뒤에 받는다 (specs/domain-events/spec.md). 커밋 뒤에는 계정 행이
 * 없으므로 표시용 값을 지우기 전에 담는다. 탈퇴는 디스코드 role 을 떼지 않아서 운영자가 손으로 정리하도록 알린다 (specs/ops-alerts/spec.md).
 *
 * @param discordUserId 탈퇴 시점의 디스코드 ID, 미연동이면 null
 * @param studyIds 탈퇴 직전 명부에 있던(ACTIVE·PAUSED) 스터디 — 스터디 role 이 남아 있을 수 있는 곳
 * @param navigator 그중 하나라도 네비게이터(LEADER)였으면 true — 네비게이터 role 도 남아 있을 수 있다
 */
public record AccountDeleted(
        EventMeta meta,
        Long accountId,
        String nickname,
        String discordUserId,
        String discordHandle,
        List<Long> studyIds,
        boolean navigator)
        implements DomainEvent {

    public static final String NAME = "account.deleted";

    /** 본인이 탈퇴하므로 행위자 = 그 계정. */
    public static AccountDeleted of(Account account, List<Long> studyIds, boolean navigator) {
        return new AccountDeleted(
                EventMeta.now(account.getId()),
                account.getId(),
                account.getNickname(),
                account.getDiscordId(),
                account.getDiscordHandle(),
                List.copyOf(studyIds),
                navigator);
    }

    @Override
    public String name() {
        return NAME;
    }

    @Override
    public String aggregateType() {
        return "account";
    }

    @Override
    public String aggregateId() {
        return String.valueOf(accountId);
    }
}
