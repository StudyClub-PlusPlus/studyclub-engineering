package com.studyclub.domain.application;

import java.util.Collection;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StudyApplicationRepository extends JpaRepository<StudyApplication, Long> {

    /**
     * 코호트별 정원을 차지하는 신청자 수. 심사 대기(PENDING)와 승인(APPROVED)만 센다 — 거절·철회는 자리를 비웠고, 대기자는 애초에 정원 밖이라 셋 다
     * 제외한다.
     *
     * <p>목록의 "N명 신청" 표시와 정원 도달 판정이 같은 수를 쓴다. 프론트가 이미 이 값을 {@code seats.taken} 으로 그리고 있어 두 수가 갈리면
     * 21/20 같은 표시가 나온다.
     */
    @Query(
            "SELECT a.studyCohortId, COUNT(a) FROM StudyApplication a "
                    + "WHERE a.studyCohortId IN :cohortIds AND a.status IN "
                    + "(com.studyclub.domain.application.ApplicationStatus.PENDING, "
                    + "com.studyclub.domain.application.ApplicationStatus.APPROVED) "
                    + "GROUP BY a.studyCohortId")
    List<Object[]> countByCohortIds(@Param("cohortIds") Collection<Long> cohortIds);
}
