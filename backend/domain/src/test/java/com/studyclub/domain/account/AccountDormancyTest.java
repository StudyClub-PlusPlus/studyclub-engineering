package com.studyclub.domain.account;

import static org.assertj.core.api.Assertions.assertThat;

import com.studyclub.domain.participant.ParticipationPeriod;
import com.studyclub.domain.support.BaseEntity;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class AccountDormancyTest {
    private static final Instant NOW = Instant.parse("2026-11-01T12:00:00Z");
    private static final Instant CUTOFF = NOW.minus(180, ChronoUnit.DAYS);
    private static final Instant OLD = NOW.minus(300, ChronoUnit.DAYS);

    @Test
    @DisplayName("참여와 로그인이 모두 180일보다 오래됐을 때만 휴면이다 — 한쪽만 오래돼서는 안 된다")
    void requiresBothInactivities() throws Exception {
        Account account = account(SystemRole.MEMBER, OLD);
        assertThat(account.isDormant(OLD, List.of(), NOW)).isTrue();
        assertThat(account.isDormant(NOW, List.of(), NOW)).isFalse();
        assertThat(account.isDormant(OLD, List.of(new ParticipationPeriod(OLD, NOW)), NOW))
                .isFalse();
        assertThat(account.isDormant(OLD, List.of(new ParticipationPeriod(OLD, OLD)), NOW))
                .isTrue();
    }

    @Test
    @DisplayName("정확히 180일 전의 가입·로그인·참여는 최근 기록에 포함한다")
    void includesExactBoundary() throws Exception {
        assertThat(account(SystemRole.MEMBER, CUTOFF).isDormant(OLD, List.of(), NOW)).isFalse();
        Account account = account(SystemRole.MEMBER, OLD);
        assertThat(account.isDormant(CUTOFF, List.of(), NOW)).isFalse();
        assertThat(account.isDormant(CUTOFF.minusNanos(1), List.of(), NOW)).isTrue();
        assertThat(account.isDormant(OLD, List.of(new ParticipationPeriod(OLD, CUTOFF)), NOW))
                .isFalse();
        assertThat(
                        account.isDormant(
                                OLD,
                                List.of(new ParticipationPeriod(OLD, CUTOFF.minusNanos(1))),
                                NOW))
                .isTrue();
    }

    @Test
    @DisplayName("캡틴과 크루는 같은 기준이며 신규 회원은 휴면에서 제외한다")
    void rolesAndNewAccounts() throws Exception {
        for (SystemRole role : SystemRole.values()) {
            assertThat(account(role, OLD).isDormant(OLD, List.of(), NOW)).isTrue();
            assertThat(account(role, NOW.minus(7, ChronoUnit.DAYS)).isDormant(OLD, List.of(), NOW))
                    .isFalse();
        }
    }

    @Test
    @DisplayName("가입·로그인·명부 정보가 없으면 휴면으로 단정하지 않는다")
    void unknownHistoryIsNotDormant() throws Exception {
        assertThat(account(SystemRole.MEMBER, null).isDormant(OLD, List.of(), NOW)).isFalse();
        Account account = account(SystemRole.MEMBER, OLD);
        assertThat(account.isDormant(null, List.of(), NOW)).isFalse();
        assertThat(account.isDormant(OLD, null, NOW)).isFalse();
        for (ParticipationPeriod period :
                List.of(
                        new ParticipationPeriod(OLD, null),
                        new ParticipationPeriod(null, OLD),
                        new ParticipationPeriod(NOW, OLD))) {
            assertThat(account.isDormant(OLD, List.of(period), NOW)).isFalse();
        }
    }

    @Test
    @DisplayName("여러 스터디·반 중 하나라도 최근 참여이면 휴면이 아니다")
    void anyRecentParticipationPreventsDormancy() throws Exception {
        Account account = account(SystemRole.MEMBER, OLD);
        var oldPeriod = new ParticipationPeriod(OLD, OLD);
        assertThat(account.isDormant(OLD, List.of(oldPeriod, oldPeriod), NOW)).isTrue();
        assertThat(
                        account.isDormant(
                                OLD, List.of(oldPeriod, new ParticipationPeriod(OLD, NOW)), NOW))
                .isFalse();
    }

    private static Account account(SystemRole role, Instant createdAt) throws Exception {
        Account account = new Account("dormancy@example.com", "휴면예시", null, role);
        var field = BaseEntity.class.getDeclaredField("createdAt");
        field.setAccessible(true);
        field.set(account, createdAt);
        return account;
    }
}
