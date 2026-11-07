package com.studyclub.domain.audit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.retention.RetentionPolicy;
import com.studyclub.domain.support.BaseEntity;
import java.lang.reflect.Field;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class AdminAuditLogTest {
    @Test
    @DisplayName("접속 기록과 일반 크루 중단은 저장된 V1의 1년 경계에서 만료된다")
    void accessBoundary() throws Exception {
        for (AdminAuditLog entry :
                List.of(
                        AdminAuditLog.emailReveal(1L, 2L),
                        AdminAuditLog.discordReveal(1L, 2L),
                        AdminAuditLog.withdraw(
                                1L, 2L, 3L, ParticipantStatus.ACTIVE, ParticipantRole.MEMBER))) {
            created(entry, "2025-10-31T12:00:00Z");
            Instant expiry = Instant.parse("2026-10-31T12:00:00Z");
            assertThat(entry.isRetentionExpired(expiry.minusNanos(1))).isFalse();
            assertThat(entry.isRetentionExpired(expiry)).isTrue();
            assertThat(entry.getRetentionPolicy()).isEqualTo(RetentionPolicy.AUDIT_ACCESS_V1);
            assertThatThrownBy(() -> entry.selectRetentionPolicy(2))
                    .isInstanceOf(IllegalStateException.class);
        }
    }

    @Test
    @DisplayName("권한 변경·말소는 3년, 윤일은 해당 연도의 2월 말일에 만료된다")
    void authorityLeapBoundary() throws Exception {
        for (AdminAuditLog entry :
                List.of(
                        AdminAuditLog.roleChange(1L, 2L, SystemRole.MEMBER, SystemRole.ADMIN),
                        AdminAuditLog.participantRoleChange(1L, 2L, 3L, ParticipantRole.MEMBER),
                        AdminAuditLog.withdraw(
                                1L, 2L, 3L, ParticipantStatus.PAUSED, ParticipantRole.LEADER),
                        AdminAuditLog.accountRoleRevoked(1L),
                        AdminAuditLog.participantRoleRevoked(1L, 3L))) {
            created(entry, "2024-02-29T12:00:00Z");
            Instant expiry = Instant.parse("2027-02-28T12:00:00Z");
            assertThat(entry.isRetentionExpired(expiry.minusNanos(1))).isFalse();
            assertThat(entry.isRetentionExpired(expiry)).isTrue();
        }
    }

    @Test
    @DisplayName("과거 참여 중단의 역할을 모르면 오래됐더라도 자동 삭제하지 않는다")
    void unknownHistoricalRoleIsHeld() throws Exception {
        AdminAuditLog entry = AdminAuditLog.withdraw(1L, 2L, 3L, ParticipantStatus.ACTIVE, null);
        created(entry, "2020-01-01T00:00:00Z");
        assertThat(entry.isRetentionExpired(Instant.parse("2030-01-01T00:00:00Z"))).isFalse();
    }

    @Test
    @DisplayName("새 기록에 2년 규칙을 선택하면 그 규칙과 만료일을 고정한다")
    void newRecordCanSelectTwoYears() throws Exception {
        AdminAuditLog entry = AdminAuditLog.emailReveal(1L, 2L);
        entry.selectRetentionPolicy(2);
        created(entry, "2025-10-31T12:00:00Z");
        entry.initializeLegacyRetention();
        assertThat(entry.getRetentionPolicy()).isEqualTo(RetentionPolicy.AUDIT_ACCESS_TWO_YEARS_V1);
        assertThat(entry.isRetentionExpired(Instant.parse("2026-10-31T12:00:00Z"))).isFalse();
        assertThat(entry.isRetentionExpired(Instant.parse("2027-10-31T12:00:00Z"))).isTrue();
    }

    private void created(AdminAuditLog entry, String instant) throws Exception {
        Field field = BaseEntity.class.getDeclaredField("createdAt");
        field.setAccessible(true);
        field.set(entry, Instant.parse(instant));
        entry.initializeNewRetention();
    }
}
