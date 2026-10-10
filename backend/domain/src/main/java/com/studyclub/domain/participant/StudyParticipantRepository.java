package com.studyclub.domain.participant;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StudyParticipantRepository extends JpaRepository<StudyParticipant, Long> {

    List<StudyParticipant> findByStudyId(Long studyId);

    void deleteByStudyId(Long studyId);

    /** 내 스터디 목록(MyStudyQueryService)과 회원 탈퇴 익명화(AccountDeletionService) 공용 조회. */
    List<StudyParticipant> findByAccountId(Long accountId);

    List<StudyParticipant> findByStudyGroupId(Long studyGroupId);

    List<StudyParticipant> findByStudyGroupIdAndStatusIn(
            Long studyGroupId, Collection<ParticipantStatus> statuses);

    /** 한 기수 안 여러 반 동시 소속은 금지라 많아야 하나다. 회차 관리 화면이 분반을 지정하지 않았을 때 쓴다. */
    Optional<StudyParticipant> findFirstByStudyIdAndAccountId(Long studyId, Long accountId);

    /** 분반 안 내 명부 행 — (ACCOUNT_ID, STUDY_GROUP_ID) 가 유일하다. 회차 보기·발표 신청 판정에 쓴다. */
    Optional<StudyParticipant> findByStudyGroupIdAndAccountId(Long studyGroupId, Long accountId);

    boolean existsByStudyGroupIdAndAccountIdAndParticipantRole(
            Long studyGroupId, Long accountId, ParticipantRole participantRole);

    boolean existsByStudyGroupIdAndAccountIdAndParticipantRoleIn(
            Long studyGroupId, Long accountId, Collection<ParticipantRole> participantRoles);

    List<StudyParticipant> findByIdInAndStudyId(Collection<Long> ids, Long studyId);

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
