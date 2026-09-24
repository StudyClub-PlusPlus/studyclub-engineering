package com.studyclub.api.study;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.StudyParticipantRepository;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * "이 스터디의 캡틴인가" 한 곳에서 판정한다 — ADMIN 이거나 그 스터디의 LEADER·CO_LEADER.
 *
 * <p>같은 판정이 서비스마다 인라인으로 흩어지면 캡틴의 정의가 따로 늙는다. 권한을 바꿀 일이 생기면 여기만 고친다.
 */
@Component
public class StudyCaptainGuard {

    private static final List<ParticipantRole> CAPTAIN_ROLES =
            List.of(ParticipantRole.LEADER, ParticipantRole.CO_LEADER);

    private final AccountRepository accountRepository;
    private final StudyParticipantRepository studyParticipantRepository;

    public StudyCaptainGuard(
            AccountRepository accountRepository,
            StudyParticipantRepository studyParticipantRepository) {
        this.accountRepository = accountRepository;
        this.studyParticipantRepository = studyParticipantRepository;
    }

    public void assertCaptain(Long accountId, Long studyId, String message) {
        if (accountId == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        Account account =
                accountRepository
                        .findById(accountId)
                        .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED));
        if (account.getSystemRole() == SystemRole.ADMIN) {
            return;
        }
        boolean captain =
                studyParticipantRepository.existsByStudyIdAndAccountIdAndParticipantRoleIn(
                        studyId, accountId, CAPTAIN_ROLES);
        if (!captain) {
            throw new BusinessException(ErrorCode.FORBIDDEN, message);
        }
    }
}
