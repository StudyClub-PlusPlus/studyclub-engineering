package com.studyclub.domain.audit;

import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.support.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.ZoneOffset;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/** 운영 행위의 최소 스냅샷. 계정 삭제 뒤에도 ID·IP는 개인정보일 수 있어 접근 제한과 만료 파기를 적용한다. */
@Entity
@Table(
        name = "ADMIN_AUDIT_LOG",
        indexes = {
            @Index(
                    name = "idx_admin_audit_log_target",
                    columnList = "TARGET_ACCOUNT_ID, CREATED_AT"),
            @Index(name = "idx_admin_audit_log_actor", columnList = "ACTOR_ACCOUNT_ID, CREATED_AT"),
            @Index(name = "idx_admin_audit_log_created", columnList = "CREATED_AT, ID")
        })
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AdminAuditLog extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ACTOR_ACCOUNT_ID", nullable = false)
    private Long actorAccountId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AdminAuditAction action;

    @Column(name = "TARGET_ACCOUNT_ID", nullable = false)
    private Long targetAccountId;

    @Column(name = "BEFORE_VALUE", length = 20)
    private String beforeValue;

    @Column(name = "AFTER_VALUE", length = 20)
    private String afterValue;

    @Column(name = "ACTOR_IP", length = 45)
    private String actorIp;

    @Column(name = "PARTICIPANT_ID")
    private Long participantId;

    @Enumerated(EnumType.STRING)
    @Column(name = "PARTICIPANT_ROLE", length = 20)
    private ParticipantRole participantRole;

    @Column(name = "REASON", length = 30)
    private String reason;

    /** 요청 문맥에서 검증된 접속 주소를 신규 로그에 담는다. */
    public void captureActorIp(String ip) {
        if (id != null || actorIp != null) {
            throw new IllegalStateException("이미 저장한 감사 기록의 접속 주소는 변경할 수 없습니다.");
        }
        this.actorIp = ip;
    }

    public boolean isRetentionExpired(Instant now, int accessYears) {
        if (accessYears != 1 && accessYears != 2) {
            throw new IllegalArgumentException("접속기록 보관 기간은 1년 또는 2년입니다.");
        }
        if (action == AdminAuditAction.WITHDRAW && participantRole == null) {
            return false;
        }
        int years =
                switch (action) {
                    case EMAIL_REVEAL, DISCORD_REVEAL -> accessYears;
                    case WITHDRAW -> participantRole == ParticipantRole.LEADER ? 3 : accessYears;
                    case ROLE_CHANGE, PARTICIPANT_ROLE, ACCOUNT_ROLE_REVOKE, PARTICIPANT_REVOKE ->
                            3;
                };
        return !now.isBefore(getCreatedAt().atZone(ZoneOffset.UTC).plusYears(years).toInstant());
    }

    public static AdminAuditLog accountRoleRevoked(Long accountId) {
        AdminAuditLog log =
                new AdminAuditLog(
                        accountId,
                        AdminAuditAction.ACCOUNT_ROLE_REVOKE,
                        accountId,
                        SystemRole.ADMIN.name(),
                        "NONE");
        log.reason = "ACCOUNT_DELETION";
        return log;
    }

    public static AdminAuditLog participantRoleRevoked(Long accountId, Long participantId) {
        AdminAuditLog log =
                new AdminAuditLog(
                        accountId,
                        AdminAuditAction.PARTICIPANT_REVOKE,
                        accountId,
                        ParticipantRole.LEADER.name(),
                        "NONE");
        log.participantId = participantId;
        log.participantRole = ParticipantRole.LEADER;
        log.reason = "ACCOUNT_DELETION";
        return log;
    }

    private AdminAuditLog(
            Long actorAccountId,
            AdminAuditAction action,
            Long targetAccountId,
            String beforeValue,
            String afterValue) {
        this.actorAccountId = actorAccountId;
        this.action = action;
        this.targetAccountId = targetAccountId;
        this.beforeValue = beforeValue;
        this.afterValue = afterValue;
    }

    /** 이메일 원본 보기. 바뀌는 값이 없어 BEFORE/AFTER 는 비운다. */
    public static AdminAuditLog emailReveal(Long actorAccountId, Long targetAccountId) {
        return new AdminAuditLog(
                actorAccountId, AdminAuditAction.EMAIL_REVEAL, targetAccountId, null, null);
    }

    /** 디스코드 아이디 보기. 원문을 저장하지 않고 요청자·대상만 기록한다. */
    public static AdminAuditLog discordReveal(Long actorAccountId, Long targetAccountId) {
        return new AdminAuditLog(
                actorAccountId, AdminAuditAction.DISCORD_REVEAL, targetAccountId, null, null);
    }

    /**
     * 계정 권한 변경. 값이 실제로 바뀐 경우에만 남긴다 — 같은 값 요청인지는 호출자(서비스)가 전이 전에 {@code before == after} 로 걸러 이 팩토리를
     * 부르지 않는다.
     */
    public static AdminAuditLog roleChange(
            Long actorAccountId, Long targetAccountId, SystemRole before, SystemRole after) {
        return new AdminAuditLog(
                actorAccountId,
                AdminAuditAction.ROLE_CHANGE,
                targetAccountId,
                before.name(),
                after.name());
    }

    /**
     * 참여 중단. 이번에 실제로 중단된 행만 남긴다 — 이미 중단된 행은 호출자가 거른다. 사유는 받지도 남기지도 않는다 (하차 · 제명을 가르지 않는다).
     *
     * <p>BEFORE 에 중단 직전 상태, AFTER 에 중단된 명부 행 ID 를 둔다. 한 사람이 스터디 여럿에 있으므로 계정 ID 만으로는 어느 행인지 모른다.
     */
    public static AdminAuditLog withdraw(
            Long actorAccountId,
            Long targetAccountId,
            Long participantId,
            ParticipantStatus before,
            ParticipantRole role) {
        AdminAuditLog log =
                new AdminAuditLog(
                        actorAccountId,
                        AdminAuditAction.WITHDRAW,
                        targetAccountId,
                        before.name(),
                        String.valueOf(participantId));
        log.participantId = participantId;
        log.participantRole = role;
        return log;
    }

    /**
     * 명부 행의 역할 변경. 실제로 바뀐 행만 남긴다 — 같은 역할 요청은 호출자가 거른다.
     *
     * <p>BEFORE 에 변경 전 역할, AFTER 에 명부 행 ID 를 둔다 — {@link #withdraw} 와 같은 이유. 역할은 둘뿐이라 변경 후 값은
     * BEFORE 의 반대다.
     */
    public static AdminAuditLog participantRoleChange(
            Long actorAccountId, Long targetAccountId, Long participantId, ParticipantRole before) {
        AdminAuditLog log =
                new AdminAuditLog(
                        actorAccountId,
                        AdminAuditAction.PARTICIPANT_ROLE,
                        targetAccountId,
                        before.name(),
                        String.valueOf(participantId));
        log.participantId = participantId;
        log.participantRole = before;
        return log;
    }
}
