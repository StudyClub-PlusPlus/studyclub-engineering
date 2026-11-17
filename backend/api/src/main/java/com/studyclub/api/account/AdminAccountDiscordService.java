package com.studyclub.api.account;

import com.studyclub.api.audit.AdminAuditRecorder;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.audit.AdminAuditLog;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 디스코드 아이디 보기. 캡틴 인가는 컨트롤러의 {@code @RequireAdmin}이 담당한다. */
@Service
public class AdminAccountDiscordService {

    private final AccountRepository accountRepository;
    private final AdminAuditRecorder auditRecorder;

    public AdminAccountDiscordService(
            AccountRepository accountRepository, AdminAuditRecorder auditRecorder) {
        this.accountRepository = accountRepository;
        this.auditRecorder = auditRecorder;
    }

    /** 이메일과 같이 기록과 원본 반환을 묶는다. 저장·커밋 실패 시 원본도 반환하지 않는다. */
    @Transactional
    public AdminAccountDiscordResponse reveal(Long actorId, Long targetId) {
        Account target =
                accountRepository
                        .findById(targetId)
                        .orElseThrow(
                                () -> new BusinessException(ErrorCode.NOT_FOUND, "회원을 찾을 수 없습니다."));
        String handle = target.getDiscordHandle();
        if (!target.isDiscordLinked() || handle == null || handle.isBlank()) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "연동된 디스코드 아이디를 찾을 수 없습니다.");
        }
        auditRecorder.record(AdminAuditLog.discordReveal(actorId, target.getId()));
        return new AdminAccountDiscordResponse(target.getId(), handle);
    }
}
