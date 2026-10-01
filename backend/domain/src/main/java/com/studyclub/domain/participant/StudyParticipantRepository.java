package com.studyclub.domain.participant;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StudyParticipantRepository extends JpaRepository<StudyParticipant, Long> {

    List<StudyParticipant> findByStudyId(Long studyId);

    void deleteByStudyId(Long studyId);

    /** 회원 탈퇴 — 익명화 대상 조회. 행을 지우지 않고 상태만 바꾸므로 삭제가 아니라 조회다 (specs/user-leave/spec.md). */
    List<StudyParticipant> findByAccountId(Long accountId);

    List<StudyParticipant> findByStudyGroupId(Long studyGroupId);

    List<StudyParticipant> findByIdInAndStudyId(Collection<Long> ids, Long studyId);

    boolean existsByAccountIdAndStudyIdAndParticipantRoleIn(
            Long accountId, Long studyId, Collection<ParticipantRole> roles);

    /** 코호트별 정원을 차지하는 참여자 수 (ACTIVE + PAUSED). 정원 도달 판정에 사용한다. */
    @Query(
            "SELECT participant.studyId, COUNT(participant) FROM StudyParticipant participant "
                    + "WHERE participant.studyId IN :studyIds "
                    + "AND participant.status IN ("
                    + "com.studyclub.domain.participant.ParticipantStatus.ACTIVE, "
                    + "com.studyclub.domain.participant.ParticipantStatus.PAUSED) "
                    + "GROUP BY participant.studyId")
    List<Object[]> countByStudyIds(@Param("studyIds") Collection<Long> studyIds);

    boolean existsByStudyIdAndAccountIdAndParticipantRoleIn(
            Long studyId, Long accountId, Collection<ParticipantRole> participantRoles);

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
