package com.studyclub.domain.participant;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StudyParticipantRepository extends JpaRepository<StudyParticipant, Long> {

    /** 코호트별 정원을 차지하는 참여자 수 (ACTIVE + PAUSED). 정원 도달 판정에 사용한다. */
    @Query(
            "SELECT p.studyId, COUNT(p) FROM StudyParticipant p "
                    + "WHERE p.studyId IN :studyIds "
                    + "AND p.status IN ("
                    + "com.studyclub.domain.participant.ParticipantStatus.ACTIVE, "
                    + "com.studyclub.domain.participant.ParticipantStatus.PAUSED) "
                    + "GROUP BY p.studyId")
    List<Object[]> countByStudyIds(@Param("studyIds") Collection<Long> studyIds);
}
