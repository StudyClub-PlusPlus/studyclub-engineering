package com.studyclub.domain.study;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface StudyRecruitmentRepository extends JpaRepository<StudyRecruitment, Long> {

    /** 스터디별 가장 최근(id 최대) 모집 회차 1건씩 반환. 목록 조회 전용. */
    @Query(
            "SELECT sr FROM StudyRecruitment sr WHERE sr.id IN ("
                    + "SELECT MAX(sr2.id) FROM StudyRecruitment sr2"
                    + " WHERE sr2.studyId IN :studyIds GROUP BY sr2.studyId)")
    List<StudyRecruitment> findLatestByStudyIdIn(@Param("studyIds") Collection<Long> studyIds);

    Optional<StudyRecruitment> findFirstByStudyIdOrderByIdDesc(Long studyId);
}
