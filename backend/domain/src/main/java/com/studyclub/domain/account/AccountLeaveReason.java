package com.studyclub.domain.account;

import com.studyclub.domain.support.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 탈퇴 사유 집계 로그. 어떤 애그리거트에도 속하지 않는다 — {@code ACCOUNT_ID} 를 두지 않는다. 계정이 지워지면 이을 대상도 없고, 사유는 집계용이라 개인과
 * 이어질 필요가 없기 때문이다 (specs/user-leave/spec.md).
 */
@Entity
@Table(name = "ACCOUNT_LEAVE_REASON")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AccountLeaveReason extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(length = 30)
    private LeaveReason reason;

    public AccountLeaveReason(LeaveReason reason) {
        this.reason = reason;
    }
}
