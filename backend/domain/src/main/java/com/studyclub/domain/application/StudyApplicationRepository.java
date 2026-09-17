package com.studyclub.domain.application;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StudyApplicationRepository extends JpaRepository<StudyApplication, Long> {

    /** 코호트별 신청자 수. 행이 있으면 제출 완료다. */
    @Query(
            "SELECT a.studyCohortId, COUNT(a) FROM StudyApplication a "
                    + "WHERE a.studyCohortId IN :cohortIds "
                    + "GROUP BY a.studyCohortId")
    List<Object[]> countByCohortIds(@Param("cohortIds") Collection<Long> cohortIds);
}
