package com.studyclub.api.studygroup;

import com.studyclub.api.audit.AdminAuditRecorder;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.audit.AdminAuditLog;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyRepository;
import java.util.Objects;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 담당 캡틴 바꾸기 (specs/study-group/spec.md 「담당 캡틴 바꾸기」). 요청자가 캡틴인지는 {@code @RequireAdmin} 이 이미 봤다 —
 * 캡틴이면 누구나 바꾼다 (POL-0001).
 */
@Service
public class AdminStudyOwnerCaptainService {

    private final StudyRepository studyRepository;
    private final AccountRepository accountRepository;
    private final AdminAuditRecorder auditRecorder;

    public AdminStudyOwnerCaptainService(
            StudyRepository studyRepository,
            AccountRepository accountRepository,
            AdminAuditRecorder auditRecorder) {
        this.studyRepository = studyRepository;
        this.accountRepository = accountRepository;
        this.auditRecorder = auditRecorder;
    }

    @Transactional
    public OwnerCaptainResponse change(Long studyId, Long accountId, Long actorAccountId) {
        // 1. 스터디가 있는지 (404 는 스터디 먼저)
        if (!studyRepository.existsById(studyId)) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "스터디를 찾을 수 없습니다.");
        }

        // 2. 대상 계정을 잠그고 ADMIN 인지 본다. 캡틴 권한 해제도 ADMIN 행을 잠그므로, 「B 를 담당으로」와 「B 권한 해제」가 동시에 와도
        //    한쪽이 끝날 때까지 다른 쪽이 기다린다 — 크루가 담당 캡틴인 스터디가 생기지 않는다
        Account target =
                accountRepository
                        .findByIdForUpdate(accountId)
                        .orElseThrow(
                                () -> new BusinessException(ErrorCode.NOT_FOUND, "회원을 찾을 수 없습니다."));
        if (target.getSystemRole() != SystemRole.ADMIN) {
            throw new BusinessException(ErrorCode.OWNER_CAPTAIN_NOT_ADMIN);
        }

        // 2-1. 스터디 행을 잠그고 읽는다 — 동시에 온 두 바꾸기가 같은 옛 값을 BEFORE 로 남기지 않게. 잠금 순서는 「계정 → 스터디」로
        //      캡틴 권한 해제(「ADMIN 행 → 담당 스터디」)와 같다
        Study study =
                studyRepository
                        .findByIdForUpdate(studyId)
                        .orElseThrow(
                                () ->
                                        new BusinessException(
                                                ErrorCode.NOT_FOUND, "스터디를 찾을 수 없습니다."));

        // 3. 같은 사람이면 아무것도 바꾸지 않는다 — 감사 기록도 남기지 않는다
        Long before = study.getOwnerCaptainId();
        if (!Objects.equals(before, accountId)) {
            // 5~6. 값 전이와 감사 기록은 같은 트랜잭션
            study.changeOwnerCaptain(accountId);
            auditRecorder.record(
                    AdminAuditLog.ownerCaptainChange(actorAccountId, studyId, before, accountId));
        }
        return new OwnerCaptainResponse(
                studyId,
                new OwnerCaptainResponse.OwnerCaptain(target.getId(), target.getNickname()));
    }
}
