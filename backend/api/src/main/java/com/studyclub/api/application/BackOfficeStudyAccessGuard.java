package com.studyclub.api.application;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.StudyParticipantRepository;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class BackOfficeStudyAccessGuard {

    private static final List<ParticipantRole> CAPTAIN_ROLES =
            List.of(ParticipantRole.LEADER, ParticipantRole.CO_LEADER);

    private final AccountRepository accountRepository;
    private final StudyParticipantRepository studyParticipantRepository;

    public BackOfficeStudyAccessGuard(
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
