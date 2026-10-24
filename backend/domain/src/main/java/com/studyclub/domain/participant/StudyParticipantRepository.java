package com.studyclub.domain.participant;

import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StudyParticipantRepository extends JpaRepository<StudyParticipant, Long> {

    List<StudyParticipant> findByStudyId(Long studyId);

    /** 백오피스 참여 명단 — 고른 상태의 행만 (specs/study-group/spec.md 「참여 명단」). */
    List<StudyParticipant> findByStudyIdAndStatusIn(
            Long studyId, Collection<ParticipantStatus> statuses);

    /** 진행 중 기수의 ACTIVE 참여 명부. 대시보드 활성 크루·1인당 참여·시간대 분포용 (specs/dashboard/spec.md 2-1). */
    @Query(
            "SELECT p FROM StudyParticipant p, Study s"
                    + " WHERE p.studyId = s.id"
                    + " AND s.status = com.studyclub.domain.study.StudyStatus.ONGOING"
                    + " AND p.status = com.studyclub.domain.participant.ParticipantStatus.ACTIVE")
    List<StudyParticipant> findActiveInOngoingStudies();

    void deleteByStudyId(Long studyId);

    /** 내 스터디 목록(MyStudyQueryService)과 회원 탈퇴 익명화(AccountDeletionService) 공용 조회. */
    List<StudyParticipant> findByAccountId(Long accountId);

    /** 회원 탈퇴가 잠글 분반 — 이 계정의 명부 행이 있는 분반. 잠금 순서를 맞추려고 ID 오름차순. */
    @Query(
            "SELECT DISTINCT p.studyGroupId FROM StudyParticipant p"
                    + " WHERE p.accountId = :accountId AND p.studyGroupId IS NOT NULL"
                    + " ORDER BY p.studyGroupId")
    List<Long> findStudyGroupIdsByAccountId(@Param("accountId") Long accountId);

    /** 회원 탈퇴 — 분반 잠금 뒤 명부 행을 잠그고 최신 값으로 읽는다. 동시에 커밋된 참여 중단을 덮어쓰지 않는다. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT p FROM StudyParticipant p WHERE p.accountId = :accountId ORDER BY p.id")
    List<StudyParticipant> findByAccountIdForUpdate(@Param("accountId") Long accountId);

    List<StudyParticipant> findByStudyGroupId(Long studyGroupId);

    List<StudyParticipant> findByStudyGroupIdAndStatusIn(
            Long studyGroupId, Collection<ParticipantStatus> statuses);

    boolean existsByStudyGroupIdAndStatusIn(
            Long studyGroupId, Collection<ParticipantStatus> statuses);

    /** 한 기수 안 여러 반 동시 소속은 금지라 많아야 하나다. 회차 관리 화면이 분반을 지정하지 않았을 때 쓴다. */
    Optional<StudyParticipant> findFirstByStudyIdAndAccountId(Long studyId, Long accountId);

    /** 분반 안 내 명부 행 — (ACCOUNT_ID, STUDY_GROUP_ID) 가 유일하다. 회차 보기·발표 신청 판정에 쓴다. */
    Optional<StudyParticipant> findByStudyGroupIdAndAccountId(Long studyGroupId, Long accountId);

    /**
     * 발표 신청 — 분반 잠금 뒤 내 명부 행을 잠그고 읽는다. 일반 조회는 잠금 전에 잡힌 스냅샷을 봐서, 잠금을 기다리는 동안 커밋된 참여 중단을 놓친다 (share
     * 10-18 D7).
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query(
            "SELECT p FROM StudyParticipant p"
                    + " WHERE p.studyGroupId = :studyGroupId AND p.accountId = :accountId")
    Optional<StudyParticipant> findByStudyGroupIdAndAccountIdForUpdate(
            @Param("studyGroupId") Long studyGroupId, @Param("accountId") Long accountId);

    boolean existsByStudyGroupIdAndAccountIdAndParticipantRole(
            Long studyGroupId, Long accountId, ParticipantRole participantRole);

    boolean existsByStudyGroupIdAndAccountIdAndParticipantRoleIn(
            Long studyGroupId, Long accountId, Collection<ParticipantRole> participantRoles);

    List<StudyParticipant> findByIdInAndStudyId(Collection<Long> ids, Long studyId);

    /** 참여 중단 대상 · 발표자 후보를 잠그고 최신 값으로 읽는다 — 회원 탈퇴 · 발표 신청과 같은 행을 두고 직렬화한다. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query(
            "SELECT p FROM StudyParticipant p WHERE p.id IN :ids AND p.studyId = :studyId ORDER BY p.id")
    List<StudyParticipant> findByIdInAndStudyIdForUpdate(
            @Param("ids") Collection<Long> ids, @Param("studyId") Long studyId);

    /** 회차 수정의 발표자 후보 — 고른 행만 잠그고 최신 상태로 읽는다. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query(
            "SELECT p FROM StudyParticipant p"
                    + " WHERE p.id IN :ids AND p.studyGroupId = :studyGroupId ORDER BY p.id")
    List<StudyParticipant> findByIdInAndStudyGroupIdForUpdate(
            @Param("ids") Collection<Long> ids, @Param("studyGroupId") Long studyGroupId);

    boolean existsByAccountIdAndStudyIdAndParticipantRoleIn(
            Long accountId, Long studyId, Collection<ParticipantRole> roles);

    /**
     * 기수별 정원을 차지하는 인원 — 명부 ACTIVE 중 정원 역할 (POL-0004). 신청 검사 {@link
     * #countByStudyIdAndStatusAndParticipantRoleIn} 와 같은 기준을 목록에서 한 번에 센다.
     */
    @Query(
            "SELECT participant.studyId, COUNT(participant) FROM StudyParticipant participant "
                    + "WHERE participant.studyId IN :studyIds "
                    + "AND participant.status = com.studyclub.domain.participant.ParticipantStatus.ACTIVE "
                    + "AND participant.participantRole IN :roles "
                    + "GROUP BY participant.studyId")
    List<Object[]> countCapacityHoldersByStudyIds(
            @Param("studyIds") Collection<Long> studyIds,
            @Param("roles") Collection<ParticipantRole> roles);

    boolean existsByStudyIdAndAccountIdAndParticipantRoleIn(
            Long studyId, Long accountId, Collection<ParticipantRole> participantRoles);

    boolean existsByStudyIdAndAccountIdAndStatusIn(
            Long studyId, Long accountId, Collection<ParticipantStatus> statuses);

    long countByStudyIdAndStatusAndParticipantRoleIn(
            Long studyId, ParticipantStatus status, Collection<ParticipantRole> roles);

    /** 스터디별 스터디장(LEADER) 목록. 분반이 여럿이면 복수 반환될 수 있으며, 호출부에서 첫 번째를 사용한다. 백오피스 목록 조회 전용. */
    @Query(
            "SELECT p FROM StudyParticipant p"
                    + " WHERE p.studyId IN :studyIds"
                    + " AND p.participantRole = com.studyclub.domain.participant.ParticipantRole.LEADER")
    List<StudyParticipant> findLeadersByStudyIdIn(@Param("studyIds") Collection<Long> studyIds);

    @Query(
            "SELECT new com.studyclub.domain.participant.StudyParticipantHistory("
                    + "participant.accountId, COUNT(participant), "
                    + "SUM(CASE WHEN participant.status = "
                    + "com.studyclub.domain.participant.ParticipantStatus.COMPLETED "
                    + "THEN 1 ELSE 0 END)) "
                    + "FROM StudyParticipant participant "
                    + "WHERE participant.accountId IN :accountIds "
                    + "AND participant.studyId <> :currentStudyId "
                    + "AND participant.status IN ("
                    + "com.studyclub.domain.participant.ParticipantStatus.COMPLETED, "
                    + "com.studyclub.domain.participant.ParticipantStatus.WITHDRAWN) "
                    + "GROUP BY participant.accountId")
    List<StudyParticipantHistory> findHistoriesByAccountIds(
            @Param("accountIds") Collection<Long> accountIds,
            @Param("currentStudyId") Long currentStudyId);
}
