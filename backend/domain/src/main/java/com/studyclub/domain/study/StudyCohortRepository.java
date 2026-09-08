package com.studyclub.domain.study;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StudyCohortRepository extends JpaRepository<StudyCohort, Long> {
    List<StudyCohort> findByStudyIdInAndStatus(Collection<Long> studyIds, StudyCohortStatus status);

    /** 스터디별 가장 최근(id 가 큰) 코호트를 가져온다. */
    @Query("SELECT c FROM StudyCohort c WHERE c.id = "
            + "(SELECT MAX(c2.id) FROM StudyCohort c2 WHERE c2.studyId = c.studyId) "
            + "AND c.studyId IN :studyIds")
    List<StudyCohort> findLatestByStudyIds(@Param("studyIds") Collection<Long> studyIds);
}
