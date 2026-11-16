package com.studyclub.api.account;

import com.studyclub.api.audit.AdminAuditRecorder;
import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.RoleChangeBlockedReason;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.audit.AdminAuditLog;
import com.studyclub.domain.study.Study;
import com.studyclub.domain.study.StudyRepository;
import com.studyclub.domain.study.StudyStatus;
import java.util.List;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 계정 권한(캡틴·크루) 변경. 요청자가 캡틴인지는 {@code @RequireAdmin} 이 이미 봤다 — <b>여기서 다시 보지 않는다</b>
 * (specs/authz-guards/spec.md). 아래 잠금은 권한 검사가 아니라 캡틴 수 판정의 동시성 장치다.
 */
@Service
public class AdminAccountRoleService {

    private final AccountRepository accountRepository;
    private final StudyRepository studyRepository;
    private final AdminAuditRecorder auditRecorder;

    public AdminAccountRoleService(
            AccountRepository accountRepository,
            StudyRepository studyRepository,
            AdminAuditRecorder auditRecorder) {
        this.accountRepository = accountRepository;
        this.studyRepository = studyRepository;
        this.auditRecorder = auditRecorder;
    }

    /** specs/admin-users/spec.md 「계정 권한 변경 › 처리 규칙」 1~7 을 그 순서대로 한 트랜잭션에서 판정한다. */
    @Transactional
    public AdminAccountRoleResponse changeSystemRole(
            Long actorId, Long targetId, SystemRole newRole) {
        // 1. ADMIN 행들을 잠그고 센다. 캡틴 둘이 동시에 서로를 내려도 먼저 온 쪽이 커밋할 때까지 뒤 요청이 기다렸다가
        //    다시 센 값을 보므로 캡틴이 0명이 되지 않는다
        List<Account> admins = accountRepository.findAllAdminsForUpdate();

        // 2. 대상 행도 명시적으로 잠그고 읽는다. 없으면 404. 잠금 순서는 언제나 「ADMIN 스캔 → 대상 행」이라 교착이 없다.
        //    (SYSTEM_ROLE 에 인덱스가 없는 MySQL REPEATABLE READ 에서는 1 이 사실상 ACCOUNT 전체 행을 잠가 대상도 보호되지만,
        //    READ COMMITTED 이거나 인덱스가 생기면 그렇지 않다 — 같은 시각의 온보딩 갱신을 우리 UPDATE 가 덮어쓰지 않게 직접 잠근다)
        Account target =
                accountRepository
                        .findByIdForUpdate(targetId)
                        .orElseThrow(
                                () -> new BusinessException(ErrorCode.NOT_FOUND, "회원을 찾을 수 없습니다."));

        // 진행 중 담당 스터디. 담당 캡틴 바꾸기도 대상 계정 행을 잠그고 ADMIN 인지 보므로, 2 의 잠금 뒤에 읽은 이 값은
        // 이 트랜잭션이 끝날 때까지 새 담당 지정으로 늘지 않는다 (specs/study-group/spec.md 「담당 캡틴 바꾸기」)
        List<Study> ownedOngoing =
                studyRepository.findByOwnerCaptainIdAndStatusNotIn(
                        targetId, StudyStatus.ENDED_STATUSES);

        // 판정은 엔티티 한 곳 — 목록이 배지를 잠그는 이유와 같은 메서드다. 캡틴 수는 1 에서 잠그고 센 값을 넘긴다
        RoleChangeBlockedReason blocked =
                target.roleChangeBlockedReason(actorId, admins.size(), !ownedOngoing.isEmpty());

        // 3. 본인이면 값이 같아도 막는다
        if (blocked == RoleChangeBlockedReason.CANNOT_CHANGE_OWN_ROLE) {
            throw new BusinessException(ErrorCode.CANNOT_CHANGE_OWN_ROLE);
        }

        // 4. 같은 값이면 아무것도 바꾸지 않고 200 — 중복 클릭·재시도에 안전하고, 감사 기록도 남기지 않는다
        SystemRole before = target.getSystemRole();
        if (before == newRole) {
            return new AdminAccountRoleResponse(target.getId(), before);
        }

        // 5. 마지막 캡틴은 내릴 수 없다 — 값이 다르고 대상이 캡틴이면 곧 내리는 요청이다
        if (blocked == RoleChangeBlockedReason.LAST_ADMIN_REQUIRED) {
            throw new BusinessException(ErrorCode.LAST_ADMIN_REQUIRED);
        }

        // 5-1. 진행 중인 스터디의 담당 캡틴은 내릴 수 없다 — 담당을 먼저 넘긴다
        if (blocked == RoleChangeBlockedReason.OWNS_STUDY) {
            String titles =
                    ownedOngoing.stream().map(Study::getTitle).collect(Collectors.joining(", "));
            throw new BusinessException(
                    ErrorCode.OWNS_STUDY,
                    "담당 중인 스터디가 있습니다: " + titles + ". 스터디 신청자 탭에서 담당 캡틴을 먼저 바꿔 주세요.");
        }

        // 5-2. 끝난 스터디만 맡았으면 담당 칸을 비운다 — 크루 계정이 담당 캡틴으로 남지 않게. 원인 기록은 아래 ROLE_CHANGE
        if (newRole == SystemRole.MEMBER) {
            studyRepository.clearOwnerCaptainIn(target.getId(), StudyStatus.ENDED_STATUSES);
        }

        // 6~7. 값 전이와 감사 기록은 같은 트랜잭션 — 기록 없이 권한만 바뀌는 일이 없다
        target.changeSystemRole(newRole);
        auditRecorder.record(AdminAuditLog.roleChange(actorId, target.getId(), before, newRole));
        return new AdminAccountRoleResponse(target.getId(), newRole);
    }
}
