package com.studyclub.domain.application;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StudyApplicationRepository extends JpaRepository<StudyApplication, Long> {

    /** 모집 회차별 신청자 수 (거절 제외). */
    @Query(
            "SELECT a.recruitmentId, COUNT(a) FROM StudyApplication a "
                    + "WHERE a.recruitmentId IN :recruitmentIds AND a.status <> com.studyclub.domain.application.ApplicationStatus.REJECTED "
                    + "GROUP BY a.recruitmentId")
    List<Object[]> countByRecruitmentIds(@Param("recruitmentIds") Collection<Long> recruitmentIds);
}
