package com.studyclub.domain.audit;

import com.studyclub.domain.account.SystemRole;
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
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 운영 감사 로그 — 캡틴이 개인정보를 보거나 권한을 바꾼 일. 어떤 애그리거트에도 속하지 않는 insert-only 로그다 (specs/admin-users/spec.md
 * 「감사 로그」).
 *
 * <p><b>계정 ID 와 행위만 담는다.</b> 이메일·닉네임을 넣으면 회원이 탈퇴해도 이 테이블에 개인정보가 남는다. {@code ACCOUNT} 와 FK 를 걸지 않는
 * 것도 같은 이유다 — 계정이 지워져도 기록은 남고, 남은 ID 로는 더 이상 사람을 되짚을 수 없다.
 *
 * <p>ACTION 과 BEFORE/AFTER 조합이 어긋나지 않게 생성자는 막고 정적 팩토리로만 만든다.
 */
@Entity
@Table(
        name = "ADMIN_AUDIT_LOG",
        indexes = {
            @Index(
                    name = "idx_admin_audit_log_target",
                    columnList = "TARGET_ACCOUNT_ID, CREATED_AT"),
            @Index(name = "idx_admin_audit_log_actor", columnList = "ACTOR_ACCOUNT_ID, CREATED_AT")
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
}
