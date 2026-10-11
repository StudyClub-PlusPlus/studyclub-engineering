package com.studyclub.api.account;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.audit.AdminAuditLog;
import com.studyclub.domain.audit.AdminAuditLogRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 이메일 원본 보기. 요청자가 캡틴인지는 {@code @RequireAdmin} 이 이미 봤다 — 여기서 다시 보지 않는다 (specs/authz-guards/spec.md).
 */
@Service
public class AdminAccountEmailService {

    private final AccountRepository accountRepository;
    private final AdminAuditLogRepository adminAuditLogRepository;

    public AdminAccountEmailService(
            AccountRepository accountRepository, AdminAuditLogRepository adminAuditLogRepository) {
        this.accountRepository = accountRepository;
        this.adminAuditLogRepository = adminAuditLogRepository;
    }

    /**
     * 대상 조회 → 감사 로그 저장 → 원본 반환을 한 트랜잭션에서 한다. 기록이 안 남으면 예외로 롤백되어 이메일이 나가지 않는다
     * (specs/admin-users/spec.md 「이메일 보기」). 본인 이메일도 똑같이 기록한다 — 예외를 두지 않는 편이 기록을 읽을 때 헷갈리지 않는다.
     */
    @Transactional
    public AdminAccountEmailResponse reveal(Long actorId, Long targetId) {
        // 없는 계정은 감사 기록도 남기지 않는다 — 본 것이 없다
        Account target =
                accountRepository
                        .findById(targetId)
                        .orElseThrow(
                                () -> new BusinessException(ErrorCode.NOT_FOUND, "회원을 찾을 수 없습니다."));
        adminAuditLogRepository.save(AdminAuditLog.emailReveal(actorId, target.getId()));
        return new AdminAccountEmailResponse(target.getId(), target.getEmail());
    }
}
