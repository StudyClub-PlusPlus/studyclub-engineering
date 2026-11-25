package com.studyclub.domain.participant;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StudyParticipantGroupMoveRepository
        extends JpaRepository<StudyParticipantGroupMove, Long> {

    /**
     * 스터디를 지울 때. 파생 삭제는 트랜잭션의 첫 조회 때 고정된 스냅샷으로 대상을 읽어서, 삭제가 반 락을 기다리는 동안 반 이동이 커밋한 기록을 놓친다. DELETE
     * 문은 최신 커밋을 읽는다 ({@code StudyNoticeRepository#deleteByStudyId} 와 같은 이유).
     */
    @Modifying
    @Query("DELETE FROM StudyParticipantGroupMove m WHERE m.studyId = :studyId")
    void deleteByStudyId(@Param("studyId") Long studyId);
}
