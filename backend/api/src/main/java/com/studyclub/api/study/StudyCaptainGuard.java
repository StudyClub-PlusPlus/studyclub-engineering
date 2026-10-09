package com.studyclub.api.study;

import com.studyclub.common.error.BusinessException;
import com.studyclub.common.error.ErrorCode;
import com.studyclub.domain.account.Account;
import com.studyclub.domain.account.AccountRepository;
import com.studyclub.domain.account.SystemRole;
import com.studyclub.domain.participant.ParticipantRole;
import com.studyclub.domain.participant.ParticipantStatus;
import com.studyclub.domain.participant.StudyParticipantRepository;
import com.studyclub.domain.study.StudyGroup;
import com.studyclub.domain.study.StudyGroupRepository;
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

    // 참여 중단(WITHDRAWN)만 뺀다 — 완주자도 지난 자료는 본다
    private static final List<ParticipantStatus> LINK_VIEWER_STATUSES =
            List.of(
                    ParticipantStatus.ACTIVE,
                    ParticipantStatus.PAUSED,
                    ParticipantStatus.COMPLETED);

    /** 분반의 활성 명부 — 쉬는 중(PAUSED)도 그 분반 사람이다. */
    public static final List<ParticipantStatus> ROSTER_STATUSES =
            List.of(ParticipantStatus.ACTIVE, ParticipantStatus.PAUSED);

    private final AccountRepository accountRepository;
    private final StudyParticipantRepository studyParticipantRepository;
    private final StudyGroupRepository studyGroupRepository;

    public StudyCaptainGuard(
            AccountRepository accountRepository,
            StudyParticipantRepository studyParticipantRepository,
            StudyGroupRepository studyGroupRepository) {
        this.accountRepository = accountRepository;
        this.studyParticipantRepository = studyParticipantRepository;
        this.studyGroupRepository = studyGroupRepository;
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

    /**
     * 출석 등 authz-guards 분반 단위 가드 — 캡틴이거나 <b>그 분반</b> 네비게이터(LEADER/CO_LEADER). 분반이 스터디에 속하는지 먼저
     * 확인하고, 타 분반 네비게이터는 막는다.
     */
    public void assertCaptainOrNavigatorOfGroup(
            Long accountId, Long studyId, Long studyGroupId, String message) {
        StudyGroup group =
                studyGroupRepository
                        .findById(studyGroupId)
                        .orElseThrow(
                                () -> new BusinessException(ErrorCode.NOT_FOUND, "분반을 찾을 수 없습니다."));
        if (!studyId.equals(group.getStudyId())) {
            throw new BusinessException(ErrorCode.INVALID_INPUT, "studyGroupId가 이 스터디에 속하지 않습니다.");
        }
        if (account(accountId).getSystemRole() == SystemRole.ADMIN) {
            return;
        }
        boolean navigator =
                studyParticipantRepository.existsByStudyGroupIdAndAccountIdAndParticipantRoleIn(
                        studyGroupId, accountId, NAVIGATOR_ROLES);
        if (!navigator) {
            throw new BusinessException(ErrorCode.FORBIDDEN, message);
        }
    }

    /**
     * 사용자 사이트 「스터디 일정」 고치기 — <b>그 스터디를 만든 캡틴</b>({@code STUDY.CREATED_BY})이거나 그 분반 네비게이터(LEADER).
     * 다른 ADMIN 은 여기서 특별 대우하지 않는다 — 참여했으면 크루다. 운영자 전체 관리는 백오피스 몫 (specs/study-meeting/spec.md 결정 3).
     */
    public boolean canEditGroup(Long accountId, Long studyCreatedBy, Long studyGroupId) {
        account(accountId);
        return accountId.equals(studyCreatedBy)
                || studyParticipantRepository.existsByStudyGroupIdAndAccountIdAndParticipantRole(
                        studyGroupId, accountId, ParticipantRole.LEADER);
    }

    public void assertCanEditGroup(
            Long accountId, Long studyCreatedBy, Long studyGroupId, String message) {
        if (!canEditGroup(accountId, studyCreatedBy, studyGroupId)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, message);
        }
    }

    /**
     * 「스터디 일정」 보기 — 고칠 수 있는 사람이거나 그 분반의 활성 참여자(ACTIVE·PAUSED). 참여를 중단한 사람은 들어오지 못한다.
     *
     * @return 고칠 수 있으면 true
     */
    public boolean assertCanViewGroup(
            Long accountId, Long studyCreatedBy, Long studyGroupId, String message) {
        if (canEditGroup(accountId, studyCreatedBy, studyGroupId)) {
            return true;
        }
        boolean member =
                studyParticipantRepository
                        .findByStudyGroupIdAndAccountId(studyGroupId, accountId)
                        .filter(p -> ROSTER_STATUSES.contains(p.getStatus()))
                        .isPresent();
        if (!member) {
            throw new BusinessException(ErrorCode.FORBIDDEN, message);
        }
        return false;
    }

    /**
     * 분반 출석부 보기 — 위 {@link #assertCaptainOrNavigatorOfGroup} 에 더해 <b>그 분반의 활성 참여자</b>도 본다. 크루는 내 분반
     * 전원의 출석을 보기만 한다 (specs/study-meeting/spec.md 구현 메모). 다른 분반은 403.
     */
    public void assertCaptainNavigatorOrMemberOfGroup(
            Long accountId, Long studyId, Long studyGroupId, String message) {
        boolean member =
                accountId != null
                        && studyParticipantRepository
                                .findByStudyGroupIdAndAccountId(studyGroupId, accountId)
                                .filter(p -> ROSTER_STATUSES.contains(p.getStatus()))
                                .filter(p -> studyId.equals(p.getStudyId()))
                                .isPresent();
        if (member) {
            return;
        }
        assertCaptainOrNavigatorOfGroup(accountId, studyId, studyGroupId, message);
    }

    /** 예외 대신 참·거짓 — 비공개 스터디를 권한 없는 사람에게 404 로 숨길 때 쓴다. 비로그인·없는 계정은 {@code false}. */
    public boolean isCaptainOrNavigator(Long accountId, Long studyId) {
        if (accountId == null) {
            return false;
        }
        return accountRepository
                .findById(accountId)
                .map(
                        account ->
                                account.getSystemRole() == SystemRole.ADMIN
                                        || studyParticipantRepository
                                                .existsByStudyIdAndAccountIdAndParticipantRoleIn(
                                                        studyId, accountId, NAVIGATOR_ROLES))
                .orElse(false);
    }

    /**
     * 디스코드 채널·자료실 링크를 볼 수 있는지 — 캡틴이거나, 참여 중단이 아닌 참여자. 네비게이터도 명부 행이라 참여 상태로 함께 걸러진다 — 하차한 네비게이터는 못
     * 본다. 링크가 곧 입장권이라 공개 상세에서도 이 사람들에게만 채운다 (share/2026-09-30-study-detail-private-urls.md). 비로그인은
     * {@code false}.
     */
    public boolean canSeePrivateLinks(Long accountId, Long studyId) {
        if (accountId == null) {
            return false;
        }
        return studyParticipantRepository.existsByStudyIdAndAccountIdAndStatusIn(
                        studyId, accountId, LINK_VIEWER_STATUSES)
                || accountRepository
                        .findById(accountId)
                        .map(account -> account.getSystemRole() == SystemRole.ADMIN)
                        .orElse(false);
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
