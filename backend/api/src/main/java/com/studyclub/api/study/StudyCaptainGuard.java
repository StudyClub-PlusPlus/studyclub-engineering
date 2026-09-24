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
 * 권한 판정을 한곳에서 한다. 정책은 POL-0001(역할과 권한) — 층이 둘이다.
 *
 * <ul>
 *   <li><b>캡틴</b>({@code ACCOUNT.SYSTEM_ROLE=ADMIN}) — 사이트 전체 권한. 백오피스는 캡틴만 들어간다
 *   <li><b>네비게이터</b>({@code STUDY_PARTICIPANT.PARTICIPANT_ROLE=LEADER}) — 맡은 스터디에 한정
 * </ul>
 *
 * <p>그래서 같은 기능이라도 <b>어느 화면에서 부르느냐</b>에 따라 판정이 다르다. 사용자 사이트에서는 네비게이터도 자기 스터디를 고칠 수 있지만, 백오피스
 * 경로({@code /api/admin})는 캡틴만 통과한다.
 */
@Component
public class StudyCaptainGuard {

    // POL-0001 은 부반장(CO_LEADER)을 없애기로 했다. enum·데이터 정리는 별도 이슈라 아직 함께 본다
    private static final List<ParticipantRole> NAVIGATOR_ROLES =
            List.of(ParticipantRole.LEADER, ParticipantRole.CO_LEADER);

    private final AccountRepository accountRepository;
    private final StudyParticipantRepository studyParticipantRepository;

    public StudyCaptainGuard(
            AccountRepository accountRepository,
            StudyParticipantRepository studyParticipantRepository) {
        this.accountRepository = accountRepository;
        this.studyParticipantRepository = studyParticipantRepository;
    }

    /** 백오피스 전용 — 캡틴(ADMIN)만. 네비게이터는 통과하지 못한다. */
    public void assertCaptain(Long accountId, String message) {
        if (account(accountId).getSystemRole() != SystemRole.ADMIN) {
            throw new BusinessException(ErrorCode.FORBIDDEN, message);
        }
    }

    /** 사용자 사이트 — 캡틴이거나 그 스터디의 네비게이터. */
    public void assertCaptainOrNavigator(Long accountId, Long studyId, String message) {
        if (account(accountId).getSystemRole() == SystemRole.ADMIN) {
            return;
        }
        boolean navigator =
                studyParticipantRepository.existsByStudyIdAndAccountIdAndParticipantRoleIn(
                        studyId, accountId, NAVIGATOR_ROLES);
        if (!navigator) {
            throw new BusinessException(ErrorCode.FORBIDDEN, message);
        }
    }

    private Account account(Long accountId) {
        if (accountId == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED);
        }
        return accountRepository
                .findById(accountId)
                .orElseThrow(() -> new BusinessException(ErrorCode.UNAUTHORIZED));
    }
}
